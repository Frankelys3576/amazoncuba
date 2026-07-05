const supabase = require('../config/supabase');

// Obtener pedidos (del usuario autenticado o todos si es admin)
const getOrders = async (req, res) => {
  try {
    // Por ahora obtenemos todos para pruebas
    // En el futuro, usar req.user.id (obtenido por middleware de auth)
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*)'); // Traemos los items del pedido también

    if (error) throw error;
    
    res.json(data || []);
  } catch (error) {
    console.error('Error fetching orders:', error.message);
    res.status(500).json({ error: 'Error al obtener los pedidos' });
  }
};

// Crear un pedido
const createOrder = async (req, res) => {
  try {
    const { customer_name, customer_email, customer_address, total, items } = req.body;
    
    // 1. Crear el pedido
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert([
        { customer_name, customer_email, customer_address, total, status: 'pending' }
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

module.exports = {
  getOrders,
  createOrder
};
