// Comprueba la superficie pública del backend: el estado de los pedidos, el
// recálculo de totales, el filtro de estado de las tiendas y la validación
// de reseñas (límite de tasa y rango de la valoración).
//
// MODE=local      ejecuta TODAS las comprobaciones, incluidas las que
//                 escriben datos de prueba (crea productos, pedidos y
//                 reseñas desechables). Necesita una cuenta de vendedor con
//                 tienda propia y una cuenta de administrador.
// MODE=production (por defecto) sólo ejecuta lo que es seguro contra un
//                 sistema en producción: comprobaciones de sólo lectura y
//                 rechazos contra ids inexistentes, que nunca tocan una fila
//                 real.
//
// Configuración por variables de entorno (nunca se lee un archivo .env):
//   BASE, ADMIN_EMAIL, ADMIN_PASSWORD, SELLER_EMAIL, SELLER_PASSWORD, MODE
//
// Sigue la forma de backend/smoke_admin_auth.mjs: mismo check(), mismas
// etiquetas en español, misma configuración por variables de entorno.
const BASE = process.env.BASE || 'http://localhost:5001';
const MODE = process.env.MODE || 'production';

let failures = 0;
const check = (cond, label) => {
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}`);
  if (!cond) failures++;
};

// Un uuid con formato válido que no existe en ninguna tabla. Sirve para
// probar rechazos (401/403/400) sin arriesgarse a tocar una fila real: toda
// comprobación que use este id y reciba un código de error nunca llegó a
// ejecutar el UPDATE/SELECT contra un registro existente.
const FAKE = '00000000-0000-7000-8000-000000000000';

const call = async (method, path, { token, body, xff } = {}) => {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(xff ? { 'X-Forwarded-For': xff } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let json = null;
  try { json = await r.json(); } catch { /* respuesta sin cuerpo JSON */ }
  return { status: r.status, json };
};

const login = async (email, password) => {
  const { json } = await call('POST', '/api/auth/login', { body: { email, password } });
  return {
    token: json?.session?.access_token ?? null,
    id: json?.user?.id ?? null,
    storeId: json?.store?.id ?? null,
  };
};

const admin = await login(process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD);
const seller = await login(process.env.SELLER_EMAIL, process.env.SELLER_PASSWORD);
check(Boolean(admin.token), 'la cuenta de administrador inicia sesión');
check(Boolean(seller.token), 'la cuenta de vendedor inicia sesión');
check(Boolean(seller.storeId), 'la cuenta de vendedor tiene una tienda asociada');

// ===========================================================================
// Estado de los pedidos (PUT /api/orders/:id)
// ===========================================================================
console.log('\n-- estado de los pedidos: rechazos contra un id inexistente (seguro en ambos modos) --');

// Sin credencial, sólo 'delivered' está permitido -- conocer el id del
// pedido ES la credencial del cliente. Con un id que no existe, esto es un
// rechazo puro: la petición nunca llega a actualizar nada.
check((await call('PUT', `/api/orders/${FAKE}`, { body: { status: 'shipped' } })).status === 403,
  "PUT /api/orders/:id sin credencial, status:'shipped' responde 403");
check((await call('PUT', `/api/orders/${FAKE}`, { body: { status: 'cualquier cosa' } })).status === 403,
  "PUT /api/orders/:id sin credencial, status:'cualquier cosa' responde 403");

// El administrador se salta la autorización de authorizeOrderUpdate, pero el
// controlador valida el estado contra la lista blanca antes de tocar la
// base de datos -- por eso esto es 400 (formato/valor inválido), no 403
// (autorización). Con un id inexistente, un 400 confirma que la validación
// ocurrió antes de la consulta.
check((await call('PUT', `/api/orders/${FAKE}`, { token: admin.token, body: { status: 'cualquier cosa' } })).status === 400,
  "PUT /api/orders/:id con token de administrador, status:'cualquier cosa' responde 400 (lista blanca, no autorización)");

// El vendedor no es dueño de un pedido que no existe: sellerOwnsOrder no
// encuentra filas y el middleware corta con 403 antes de tocar nada.
check((await call('PUT', `/api/orders/${FAKE}`, { token: seller.token, body: { status: 'shipped' } })).status === 403,
  'PUT /api/orders/:id con token de vendedor sobre un pedido que no contiene su producto responde 403');

if (MODE === 'local') {
  console.log('\n-- estado de los pedidos: contra pedidos de prueba reales --');

  // Un producto cualquiera, público, para crear un pedido "de cliente"
  // desechable sobre el que probar 'delivered' sin credencial.
  const { json: anyProducts } = await call('GET', '/api/products');
  const anyProduct = Array.isArray(anyProducts) ? anyProducts[0] : null;
  check(Boolean(anyProduct?.id), 'hay al menos un producto público para crear pedidos de prueba');

  if (anyProduct?.id) {
    const { status: createStatus, json: deliveryOrder } = await call('POST', '/api/orders', {
      body: {
        customer_name: 'Cliente Smoke',
        customer_email: 'cliente-smoke@example.test',
        items: [{ product_id: anyProduct.id, quantity: 1 }],
      },
    });
    check(createStatus === 201, 'se crea un pedido de prueba desechable (para la comprobación de "delivered")');
    const deliveryOrderId = deliveryOrder?.order?.id;

    check(Boolean(deliveryOrderId) &&
      (await call('PUT', `/api/orders/${deliveryOrderId}`, { body: { status: 'delivered' } })).status === 200,
      "PUT /api/orders/:id sin credencial, status:'delivered' responde 200");
  }

  // Un producto de la tienda del vendedor, para probar que SÍ puede marcar
  // 'shipped' un pedido que contiene su propio producto.
  const { status: prodStatus, json: sellerProduct } = await call('POST', '/api/products', {
    token: seller.token,
    body: {
      name: 'Producto Smoke Estado',
      price: 12.5,
      currency: 'USD',
      store_id: seller.storeId,
      province: 'La Habana',
      municipality: 'Playa',
    },
  });
  check(prodStatus === 201, 'el vendedor crea un producto de prueba desechable');

  if (sellerProduct?.id) {
    const { status: ownOrderStatus, json: ownOrder } = await call('POST', '/api/orders', {
      body: {
        customer_name: 'Cliente Smoke',
        customer_email: 'cliente-smoke@example.test',
        items: [{ product_id: sellerProduct.id, quantity: 1 }],
      },
    });
    check(ownOrderStatus === 201, 'se crea un pedido de prueba que contiene el producto del vendedor');
    const ownOrderId = ownOrder?.order?.id;

    check(Boolean(ownOrderId) &&
      (await call('PUT', `/api/orders/${ownOrderId}`, { token: seller.token, body: { status: 'shipped' } })).status === 200,
      "PUT /api/orders/:id con token de VENDEDOR sobre un pedido que SÍ contiene su producto, status:'shipped' responde 200");
  }
}

// ===========================================================================
// Totales de los pedidos (POST /api/orders)
// ===========================================================================
console.log('\n-- totales de los pedidos --');

{
  const { json: products } = await call('GET', '/api/products');
  const product = Array.isArray(products) ? products.find((p) => p && p.price != null) : null;
  check(Boolean(product?.id), 'hay un producto público con precio para probar los totales');

  if (product?.id) {
    const trueUnitPrice = Number(product.price);

    // total: 0.01 y price: 0.01 en el cuerpo: el total y el price_at_purchase
    // guardados deben salir de la base de datos, no de lo que mandó el cliente.
    const { status: bogusStatus, json: bogusOrder } = await call('POST', '/api/orders', {
      body: {
        customer_name: 'Cliente Smoke Totales',
        customer_email: 'totales-smoke@example.test',
        total: 0.01,
        items: [{ product_id: product.id, quantity: 1, price: 0.01 }],
      },
    });
    check(bogusStatus === 201, "POST /api/orders con total:0.01 y price:0.01 se crea (201)");
    const bogusOrderId = bogusOrder?.order?.id;
    check(Boolean(bogusOrderId) && Number(bogusOrder.order.total) !== 0.01,
      'el total guardado en la respuesta NO es 0.01 (viene de la base de datos)');

    if (bogusOrderId) {
      // ids= es público -- conocer el id del pedido recién creado ES la
      // credencial, igual que para el cliente real.
      const { status: fetchStatus, json: fetched } = await call('GET', `/api/orders?ids=${bogusOrderId}`);
      const fetchedOrder = Array.isArray(fetched) ? fetched[0] : null;
      const item = fetchedOrder?.order_items?.[0];
      check(fetchStatus === 200 && Boolean(item), 'se puede releer el pedido recién creado con ?ids=');
      check(Boolean(item) && Number(item.price_at_purchase) !== 0.01,
        'price_at_purchase guardado NO es 0.01 (viene de la base de datos)');
      check(Boolean(item) && Math.abs(Number(item.price_at_purchase) - trueUnitPrice) < 0.001,
        'price_at_purchase guardado coincide con el precio real del producto en la base de datos');
    }

    // product_id inexistente -> 400
    check((await call('POST', '/api/orders', {
      body: {
        customer_name: 'Cliente Smoke',
        customer_email: 'cliente-smoke@example.test',
        items: [{ product_id: FAKE, quantity: 1 }],
      },
    })).status === 400, 'POST /api/orders con un product_id inexistente responde 400');

    // quantity: 0 -> 400
    check((await call('POST', '/api/orders', {
      body: {
        customer_name: 'Cliente Smoke',
        customer_email: 'cliente-smoke@example.test',
        items: [{ product_id: product.id, quantity: 0 }],
      },
    })).status === 400, 'POST /api/orders con quantity:0 responde 400');
  }
}

if (MODE === 'local') {
  console.log('\n-- totales de los pedidos: carrito con dos monedas --');

  const currencyA = `USD`;
  const currencyB = `CUP`;

  const { status: statusA, json: productA } = await call('POST', '/api/products', {
    token: seller.token,
    body: {
      name: 'Producto Smoke Moneda A', price: 10, currency: currencyA,
      store_id: seller.storeId, province: 'La Habana', municipality: 'Playa',
    },
  });
  const { status: statusB, json: productB } = await call('POST', '/api/products', {
    token: seller.token,
    body: {
      name: 'Producto Smoke Moneda B', price: 250, currency: currencyB,
      store_id: seller.storeId, province: 'La Habana', municipality: 'Playa',
    },
  });
  check(statusA === 201 && statusB === 201, 'se crean dos productos de prueba con monedas distintas');

  if (productA?.id && productB?.id) {
    const { status: mixStatus, json: mixOrder } = await call('POST', '/api/orders', {
      body: {
        customer_name: 'Cliente Smoke Monedas',
        customer_email: 'monedas-smoke@example.test',
        items: [
          { product_id: productA.id, quantity: 1 },
          { product_id: productB.id, quantity: 1 },
        ],
      },
    });
    check(mixStatus === 201, 'se crea un pedido con un carrito de dos monedas');
    const totalsKeys = mixOrder?.totals ? Object.keys(mixOrder.totals) : [];
    check(totalsKeys.length === 2, `la respuesta trae "totals" con dos claves (tiene ${totalsKeys.length}: ${totalsKeys.join(', ')})`);
  }
}

// ===========================================================================
// Listado de tiendas (GET /api/stores)
// ===========================================================================
console.log('\n-- listado de tiendas --');

{
  const { status: anonStatus, json: anonStores } = await call('GET', '/api/stores');
  check(anonStatus === 200, 'GET /api/stores (anónimo) responde 200');
  const stores = Array.isArray(anonStores) ? anonStores : [];
  check(stores.length > 0, 'GET /api/stores (anónimo) devuelve al menos una tienda');
  check(stores.every((s) => s.status === 'approved'),
    'GET /api/stores (anónimo): todas las tiendas devueltas tienen status === "approved"');

  const leaks = stores.some((s) =>
    Object.prototype.hasOwnProperty.call(s, 'user_id') ||
    Object.prototype.hasOwnProperty.call(s, 'zelle_info') ||
    Object.keys(s).some((k) => k.startsWith('legacy_'))
  );
  check(!leaks, 'GET /api/stores (anónimo): ninguna tienda expone user_id, legacy_* ni zelle_info');

  const { status: adminStatus, json: adminStores } = await call('GET', '/api/stores', { token: admin.token });
  check(adminStatus === 200, 'GET /api/stores (token de administrador) responde 200');
  const adminList = Array.isArray(adminStores) ? adminStores : [];
  check(adminList.some((s) => s.status === 'pending'),
    'GET /api/stores (token de administrador): aparecen tiendas "pending"');
  check(adminList.some((s) => s.status === 'rejected'),
    'GET /api/stores (token de administrador): aparecen tiendas "rejected"');
}

// ===========================================================================
// Límite de tasa y validación de reseñas (POST /api/products/:id/reviews)
// ===========================================================================
if (MODE === 'local') {
  console.log('\n-- límite de tasa y validación de reseñas --');

  const { json: products } = await call('GET', '/api/products');
  const product = Array.isArray(products) ? products[0] : null;
  check(Boolean(product?.id), 'hay un producto público para probar reseñas');

  if (product?.id) {
    // Cada bloque usa su propia X-Forwarded-For. trust proxy = 1 confía en
    // exactamente un salto, así que Express toma este valor como el ip del
    // llamante (ver el comentario en src/index.js): esto separa el
    // presupuesto del limitador (5 peticiones/hora POR IP) entre bloques de
    // comprobación independientes dentro del mismo proceso, sin tocar el
    // límite en sí ni el código de producción.
    const validationIP = '10.0.0.1';
    const rateLimitIP = '10.0.0.2';

    console.log('  -- validación de la valoración --');
    check((await call('POST', `/api/products/${product.id}/reviews`, {
      xff: validationIP, body: { customer_name: 'Smoke', rating: 999 },
    })).status === 400, "rating:999 responde 400");
    check((await call('POST', `/api/products/${product.id}/reviews`, {
      xff: validationIP, body: { customer_name: 'Smoke', rating: -1 },
    })).status === 400, "rating:-1 responde 400");
    check((await call('POST', `/api/products/${product.id}/reviews`, {
      xff: validationIP, body: { customer_name: 'Smoke', rating: 3, comment: 'x'.repeat(2000) },
    })).status === 400, 'un comentario de 2000 caracteres responde 400');
    check((await call('POST', `/api/products/${product.id}/reviews`, {
      xff: validationIP, body: { customer_name: 'Smoke', rating: 3 },
    })).status === 201, 'rating:3 responde 201');

    console.log('  -- límite de tasa: 5 por hora por IP --');
    const results = [];
    for (let i = 0; i < 6; i++) {
      const { status } = await call('POST', `/api/products/${product.id}/reviews`, {
        xff: rateLimitIP, body: { customer_name: 'Smoke Rate', rating: 4 },
      });
      results.push(status);
    }
    check(results[5] === 429, `la 6ª petición rápida responde 429 (secuencia: ${results.join(', ')})`);
  }
} else {
  console.log('\n(MODE=production: no se comprueban totales con dos monedas, estado de pedidos reales, ni reseñas -- todas escriben datos)');
}

console.log(failures === 0 ? '\nPASS' : `\nFAIL: ${failures} comprobación(es)`);
process.exit(failures === 0 ? 0 : 1);
