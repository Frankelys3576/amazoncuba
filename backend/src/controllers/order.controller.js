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
    const { customer_name, customer_email, customer_address, customer_phone, total, items, payment_method, payment_proof_url } = req.body;
    
    // 1. Crear el pedido (asegurándonos de guardar customer_phone y datos de pago)
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert([
        { customer_name, customer_email, customer_address, customer_phone, total, status: 'pending', payment_method: payment_method || 'cash_on_delivery', payment_proof_url }
      ])
      .select();

    if (orderError) throw orderError;
    
    const newOrderId = orderData[0].id;

    // 2. Insertar los items del pedido
    if (items && items.length > 0) {
      const orderItems = items.map(item => ({
        order_id: newOrderId,
        product_id: item.product_id,
        quantity: item.quantity,
        price_at_purchase: item.price
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;
    }
    
    res.status(201).json({ message: 'Pedido creado exitosamente', order: orderData[0] });
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
  ORDER_STATUSES,
  getOrders,
  createOrder,
  updateOrder
};
