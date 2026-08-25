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
//                 rechazos que el backend corta ANTES de escribir nada
//                 (credencial insuficiente, estado inválido, id inexistente),
//                 así que no crea ni modifica ninguna fila de negocio
//                 -- tiendas, productos, pedidos, reseñas.
//                 Lo único que deja rastro es el inicio de sesión de las dos
//                 cuentas al arrancar, que crea una sesión en Supabase Auth.
//
//                 I4: el bloque de totales creaba un pedido REAL (con sus
//                 order_items) fuera de la guarda de MODE, así que quien
//                 siguiera esta cabecera y lo apuntara a producción ensuciaba
//                 la tabla de pedidos. Ahora sólo queda ahí el rechazo por
//                 product_id inexistente. Si añades una comprobación nueva,
//                 pregúntate primero si escribe: si escribe, va dentro de
//                 `if (MODE === 'local')`.
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
console.log('\n-- totales de los pedidos: rechazos que no insertan nada (seguro en ambos modos) --');

// product_id inexistente -> 400. La comprobación de existencia ocurre antes de
// cualquier INSERT, así que esto nunca crea un pedido.
check((await call('POST', '/api/orders', {
  body: {
    customer_name: 'Cliente Smoke',
    customer_email: 'cliente-smoke@example.test',
    items: [{ product_id: FAKE, quantity: 1 }],
  },
})).status === 400, 'POST /api/orders con un product_id inexistente responde 400');

if (MODE === 'local') {
  console.log('\n-- totales de los pedidos: contra pedidos de prueba reales --');

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

    // quantity: 0 -> 400
    check((await call('POST', '/api/orders', {
      body: {
        customer_name: 'Cliente Smoke',
        customer_email: 'cliente-smoke@example.test',
        items: [{ product_id: product.id, quantity: 0 }],
      },
    })).status === 400, 'POST /api/orders con quantity:0 responde 400');

    // Cantidad desmesurada -> 400. Sin cota superior, quantity: 1e21 daba un
    // 201 y un pedido guardado con total: 2e+22 (1e21 pasa el
    // Number.isInteger).
    check((await call('POST', '/api/orders', {
      body: {
        customer_name: 'Cliente Smoke',
        customer_email: 'cliente-smoke@example.test',
        items: [{ product_id: product.id, quantity: 1e21 }],
      },
    })).status === 400, 'POST /api/orders con quantity:1e21 responde 400');

    check((await call('POST', '/api/orders', {
      body: {
        customer_name: 'Cliente Smoke',
        customer_email: 'cliente-smoke@example.test',
        items: [{ product_id: product.id, quantity: 1001 }],
      },
    })).status === 400, 'POST /api/orders con quantity:1001 responde 400');
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
    Object.keys(s).some((k) => k.startsWith('legacy_'))
  );
  check(!leaks, 'GET /api/stores (anónimo): ninguna tienda expone user_id ni legacy_*');

  // C1: zelle_info vuelve, pero SOLO el beneficiario (lo que Checkout.jsx
  // pinta). Si reapareciera el blob crudo volverían con él las claves de
  // ubicación, la galería y cualquier cosa que se guarde ahí en el futuro.
  const ZELLE_PUBLIC_KEYS = ['name', 'email_phone', 'description'];
  const zelleOk = stores.every((s) =>
    s.zelle_info &&
    Object.keys(s.zelle_info).every((k) => ZELLE_PUBLIC_KEYS.includes(k))
  );
  check(zelleOk, 'GET /api/stores (anónimo): zelle_info trae sólo name/email_phone/description');

  const { status: adminStatus, json: adminStores } = await call('GET', '/api/stores', { token: admin.token });
  check(adminStatus === 200, 'GET /api/stores (token de administrador) responde 200');
  const adminList = Array.isArray(adminStores) ? adminStores : [];
  check(adminList.some((s) => s.status === 'pending'),
    'GET /api/stores (token de administrador): aparecen tiendas "pending"');
  check(adminList.some((s) => s.status === 'rejected'),
    'GET /api/stores (token de administrador): aparecen tiendas "rejected"');
}

// ===========================================================================
// Tienda por id y por slug (GET /api/stores/:id)
// ===========================================================================
//
// I5: el hallazgo Critical de la tarea 3 -- esta ruta no filtraba por estado y
// devolvía la fila entera -- sólo estaba cubierto por pruebas e2e de NestJS
// con todo simulado, y NestJS no es el backend que sirve el tráfico. I1 es la
// prueba de que eso no basta: con .single(), un id/slug INEXISTENTE devolvía
// 500 mientras uno pendiente devolvía 404, así que la ruta confirmaba qué
// tiendas existen -- justo la propiedad por la que aquí se eligió 404 en vez
// de 403. Ninguna prueba simulada lo vio; estas comprobaciones sí lo habrían
// visto (la del slug inexistente habría dado 500 en vez de 404).
console.log('\n-- tienda por id y por slug --');

{
  const { json: adminStores } = await call('GET', '/api/stores', { token: admin.token });
  const pending = (Array.isArray(adminStores) ? adminStores : []).find((s) => s.status === 'pending');
  check(Boolean(pending?.id), 'hay una tienda pendiente en el listado de administración para probar');

  const { json: publicStores } = await call('GET', '/api/stores');
  const approved = Array.isArray(publicStores) ? publicStores[0] : null;
  check(Boolean(approved?.id), 'hay una tienda aprobada en el listado público para probar');

  if (pending?.id) {
    check((await call('GET', `/api/stores/${pending.id}`)).status === 404,
      'GET /api/stores/<id de tienda pendiente> (anónimo) responde 404');
    check(Boolean(pending.slug) &&
      (await call('GET', `/api/stores/${pending.slug}`)).status === 404,
      'GET /api/stores/<slug de tienda pendiente> (anónimo) responde 404');
    check((await call('GET', `/api/stores/${pending.id}`, { token: admin.token })).status === 200,
      'GET /api/stores/<id de tienda pendiente> con token de administrador responde 200');
  }

  // I1: una tienda oculta y una que no existe tienen que ser indistinguibles.
  // Con .single() esto era un 500 y el oráculo quedaba abierto.
  check((await call('GET', '/api/stores/no-existe-jamas')).status === 404,
    'GET /api/stores/<slug inexistente> responde 404, no 500 (mismo cuerpo que una tienda oculta)');
  check((await call('GET', `/api/stores/${FAKE}`)).status === 404,
    'GET /api/stores/<uuid inexistente> responde 404, no 500');

  if (approved?.id) {
    const { status: approvedStatus, json: approvedStore } = await call('GET', `/api/stores/${approved.id}`);
    check(approvedStatus === 200, 'GET /api/stores/<id de tienda aprobada> (anónimo) responde 200');
    check(Boolean(approvedStore) &&
      !Object.prototype.hasOwnProperty.call(approvedStore, 'user_id') &&
      !Object.keys(approvedStore).some((k) => k.startsWith('legacy_')),
      'GET /api/stores/<id de tienda aprobada>: la respuesta no trae user_id ni ninguna clave legacy_');
    check(Boolean(approvedStore?.zelle_info) &&
      Object.keys(approvedStore.zelle_info).every((k) => ['name', 'email_phone', 'description'].includes(k)),
      'GET /api/stores/<id de tienda aprobada>: zelle_info trae sólo name/email_phone/description');
    check(Boolean(approved.slug) &&
      (await call('GET', `/api/stores/${approved.slug}`)).status === 200,
      'GET /api/stores/<slug de tienda aprobada> (anónimo) responde 200');
  }
}

if (MODE === 'local') {
  console.log('\n-- tienda pendiente vista por su propio dueño --');

  // El vendedor tiene que poder ver SU tienda mientras espera aprobación
  // (es lo que ve seller-frontend justo después de registrarse). Se pone su
  // tienda en 'pending' con el token de administrador, se comprueba, y se
  // restaura a 'approved'. Escribe, así que sólo en modo local.
  const toPending = await call('PUT', `/api/stores/${seller.storeId}/status`, {
    token: admin.token, body: { status: 'pending' },
  });
  check(toPending.status === 200, 'el administrador pone la tienda del vendedor en "pending"');

  const { status: ownerStatus, json: ownerStore } = await call('GET', `/api/stores/${seller.storeId}`, { token: seller.token });
  check(ownerStatus === 200 && ownerStore?.id === seller.storeId,
    'GET /api/stores/<id> de una tienda PENDIENTE, con el token de SU dueño, responde 200');
  check((await call('GET', `/api/stores/${seller.storeId}`)).status === 404,
    'la misma tienda pendiente, sin credencial, responde 404');

  const restored = await call('PUT', `/api/stores/${seller.storeId}/status`, {
    token: admin.token, body: { status: 'approved' },
  });
  check(restored.status === 200 && restored.json?.status === 'approved',
    'la tienda del vendedor vuelve a "approved"');
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
  console.log('\n(MODE=production: no se comprueban los totales contra pedidos reales, el carrito de dos monedas, el estado de pedidos reales, la tienda pendiente vista por su dueño, ni las reseñas -- todas escriben datos)');
}

console.log(failures === 0 ? '\nPASS' : `\nFAIL: ${failures} comprobación(es)`);
process.exit(failures === 0 ? 0 : 1);
