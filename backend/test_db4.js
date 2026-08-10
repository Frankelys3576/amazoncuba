const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOrders() {
  const storeId = 21;
  const { data: orderItemsData, error: itemsError } = await supabase
    .from('order_items')
    .select('order_id, products!inner(store_id)')
    .eq('products.store_id', storeId);
  
  console.log("Order items for store 21:", JSON.stringify(orderItemsData, null, 2));
  console.log("Error:", itemsError);
}

checkOrders();
