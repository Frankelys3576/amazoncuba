require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  // First, let's get the orders to see how many there are
  const { data: orders, error: err1 } = await supabase
    .from('orders')
    .select('id')
    .eq('store_id', 21);
    
  if (err1) {
    console.error('Error fetching orders:', err1);
    return;
  }
  
  console.log(`Found ${orders.length} orders for San Jose#45`);
  
  if (orders.length > 0) {
    const orderIds = orders.map(o => o.id);
    
    // Delete order_items first just in case there's no CASCADE
    const { error: err2 } = await supabase
      .from('order_items')
      .delete()
      .in('order_id', orderIds);
      
    if (err2) console.error('Error deleting order_items:', err2);
    
    // Then delete orders
    const { error: err3 } = await supabase
      .from('orders')
      .delete()
      .eq('store_id', 21);
      
    if (err3) console.error('Error deleting orders:', err3);
    else console.log('Successfully deleted orders');
  }
}
run();
