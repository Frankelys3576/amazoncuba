const supabase = require('../config/supabase');

// Los ids son UUID v7 desde la migración. Se declara una sola vez para que
// getOrders (query ?ids=) y updateOrder (:id) validen exactamente igual.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Los tres únicos estados que usa la aplicación. Antes no se validaba nada:
// updateOrder escribía la cadena que viniera en el cuerpo, así que el estado
// de un pedido podía quedar en cualquier texto arbitrario, que luego se
// mostraba en los paneles del vendedor y del administrador.
const ORDER_STATUSES = ['pending', 'shipped', 'delivered'];

const getOrders = async (req, res) => {
  try {
    const { storeId, ids } = req.query;

    let orderIds = [];
    const idsProvided = Boolean(ids);

    if (ids) {
      orderIds = ids
        .split(',')
        .map((id) => id.trim())
        .filter((id) => UUID.test(id));
    }

    // If the caller explicitly asked for specific order ids but none of them
    // were valid uuids, they must get nothing back -- never fall through to
    // a broader query. Without this, an unauthenticated
    // `GET /api/orders?ids=garbage` would return every order on the platform,
    // PII (customer_name/email/phone/address) included. Do not "simplify"
    // this away, and keep it in sync with orders.service.ts's copy.
    //
    // I6: this used to carry an extra `&& !storeId`, so the guard was closed
    // only for the no-storeId case -- `?storeId=<uuid>&ids=garbage` still
    // returned every order for that store, PII included, on an
    // unauthenticated route, while the comment read as though the leak was
    // shut. Dropped, rather than documented as a caveat: when both params
    // are supplied and the ids ARE valid, the code below already intersects
    // them (`orderIds.filter(id => storeOrderIds.includes(id))`), so an
    // empty valid-id set returning nothing is just the limit case of the
    // intersection already implemented -- falling through to the whole store
    // was the anomaly. No client sends both params (frontend's
    // getOrdersByIds sends ids only, seller-frontend and
    // admin-frontend/AdminDirectory.jsx send storeId only).
    if (idsProvided && orderIds.length === 0) {
      return res.json([]);
    }

    if (storeId) {
      // Find all order_items that belong to products of this store
      const { data: orderItemsData, error: itemsError } = await supabase
        .from('order_items')
        .select('order_id, products!inner(store_id)')
        .eq('products.store_id', storeId);

      if (itemsError) throw itemsError;

      const storeOrderIds = [...new Set(orderItemsData.map(item => item.order_id))];
      
      if (orderIds.length > 0) {
        orderIds = orderIds.filter(id => storeOrderIds.includes(id));
      } else {
        orderIds = storeOrderIds;
      }
      
      if (orderIds.length === 0) {
        return res.json([]);
      }
    }

    let query = supabase
      .from('orders')
      .select('*, order_items(*, products(*))')
      .order('created_at', { ascending: false });

    if (orderIds.length > 0) {
      query = query.in('id', orderIds);
    }

    const { data, error } = await query;

    if (error) throw error;
    
    // If filtering by store, we should also filter the order_items in the result
    // to only show the items that belong to the store
    if (storeId && data) {
      const filteredData = data.map(order => ({
        ...order,
        order_items: order.order_items.filter(item => item.products && item.products.store_id == storeId)
      }));
      return res.json(filteredData);
    }

    res.json(data || []);
  } catch (error) {
    console.error('Error fetching orders:', error.message);
    res.status(500).json({ error: 'Error al obtener los pedidos' });
  }
};

// Crear un pedido
const createOrder = async (req, res) => {
  try {
    const { customer_name, customer_email, customer_address, customer_phone, items, payment_method, payment_proof_url } = req.body;

    // El total y los precios NO se leen del cuerpo. Antes sí: un cliente podía
    // enviar total: 0.01 y el pedido se guardaba con ese importe.
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'El pedido no tiene artículos' });
    }

    const productIds = [...new Set(items.map((item) => item.product_id))];
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, price, currency')
      .in('id', productIds);

    if (productsError) throw productsError;

    const byId = new Map((products || []).map((p) => [String(p.id), p]));
    if (productIds.some((id) => !byId.has(String(id)))) {
      return res.status(400).json({ error: 'Uno o más productos no existen' });
    }

    // Los importes se calculan por moneda: cada producto lleva la suya y un
    // carrito puede mezclarlas, así que un único número no significaría nada.
    const totals = {};
    const lines = [];

    for (const item of items) {
      const product = byId.get(String(item.product_id));
      const quantity = Number(item.quantity);

      if (!Number.isInteger(quantity) || quantity < 1) {
        return res.status(400).json({ error: 'La cantidad de cada artículo debe ser un entero positivo' });
      }

      const unitPrice = Number(product.price);
      const currency = product.currency || 'USD';

      totals[currency] = (totals[currency] || 0) + unitPrice * quantity;
      lines.push({ product_id: product.id, quantity, price_at_purchase: unitPrice });
    }

    // orders.total es NOT NULL y se conserva por compatibilidad: es la suma
    // sin distinguir moneda, exactamente lo que se guardaba antes. El dato
    // bueno es `totals`; los frontales deben leer ese.
    const legacyTotal = Object.values(totals).reduce((sum, value) => sum + value, 0);

    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert([{ customer_name, customer_email, customer_address, customer_phone, total: legacyTotal, status: 'pending', payment_method: payment_method || 'cash_on_delivery', payment_proof_url }])
      .select();

    if (orderError) throw orderError;

    const newOrderId = orderData[0].id;

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(lines.map((line) => ({ ...line, order_id: newOrderId })));

    if (itemsError) throw itemsError;

    res.status(201).json({ message: 'Pedido creado exitosamente', order: orderData[0], totals });
  } catch (error) {
    console.error('Error creating order:', error.message);
    res.status(500).json({ error: 'Error al crear el pedido' });
  }
};

const updateOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // I8: sin esto, un id que no sea uuid llega a PostgREST, que responde
    // 22P02 ("invalid input syntax for type uuid") y el catch de abajo lo
    // convierte en un 500. Se valida con la misma expresión que usa
    // getOrders para ?ids=, siguiendo el estilo del resto del backend
    // (store.controller.js hace lo mismo en línea para distinguir id de
    // slug). El mensaje es el mismo que devuelve SpanishParseUuidPipe en
    // backend-nest, para que ambos backends respondan igual.
    if (!UUID.test(id)) {
      return res.status(400).json({ error: 'El identificador debe ser un UUID válido' });
    }

    if (!ORDER_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Estado de pedido no válido' });
    }

    const { data, error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', id)
      .select();

    if (error) throw error;

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    res.json(data[0]);
  } catch (error) {
    console.error('Error updating order:', error.message);
    res.status(500).json({ error: 'Error al actualizar el pedido' });
  }
};

module.exports = {
  UUID,
  ORDER_STATUSES,
  getOrders,
  createOrder,
  updateOrder
};
