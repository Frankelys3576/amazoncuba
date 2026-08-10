const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOrders() {
  const { data: orders, error: ordersError } = await supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(5);
  console.log("Orders:", JSON.stringify(orders, null, 2));
  console.log("Orders Error:", ordersError);

  const { data: orderItems, error: itemsError } = await supabase.from('order_items').select('*').order('created_at', { ascending: false }).limit(5);
  console.log("Order Items:", JSON.stringify(orderItems, null, 2));
  console.log("Items Error:", itemsError);
}

checkOrders();
