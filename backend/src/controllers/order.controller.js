const supabase = require('../config/supabase');

const getOrders = async (req, res) => {
  try {
    const { storeId, ids } = req.query;

    let orderIds = [];
    
    if (ids) {
      orderIds = ids
        .split(',')
        .map((id) => id.trim())
        .filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));
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
  getOrders,
  createOrder,
  updateOrder
};
