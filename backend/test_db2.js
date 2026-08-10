const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOrders() {
  const { data: orderItems, error: itemsError } = await supabase.from('order_items').select('*').eq('order_id', 6);
  console.log("Order Items for ID 6:", JSON.stringify(orderItems, null, 2));
  console.log("Items Error:", itemsError);
}

checkOrders();
