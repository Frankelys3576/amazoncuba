require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const storeId = 21;
  
  // 1. Get all products for this store
  const { data: products } = await supabase.from('products').select('id').eq('store_id', storeId);
  if (!products || products.length === 0) {
    console.log('No products found for this store');
    return;
  }
  const productIds = products.map(p => p.id);
  
  // 2. Get all order_items for these products
  const { data: orderItems } = await supabase.from('order_items').select('order_id').in('product_id', productIds);
  if (!orderItems || orderItems.length === 0) {
    console.log('No orders found for this store');
    return;
  }
  
  const orderIds = [...new Set(orderItems.map(item => item.order_id))];
  console.log(`Found ${orderIds.length} orders to delete for San Jose#45`);
  
  // 3. Delete order_items first
  const { error: err1 } = await supabase.from('order_items').delete().in('order_id', orderIds);
  if (err1) console.error('Error deleting order items', err1);
  
  // 4. Delete orders
  const { error: err2 } = await supabase.from('orders').delete().in('id', orderIds);
  if (err2) console.error('Error deleting orders', err2);
  else console.log('Successfully deleted all orders for San Jose#45');
}
run();
