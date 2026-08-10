const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOrders() {
  const { data: product, error } = await supabase.from('products').select('*').eq('id', 84);
  console.log("Product 84:", JSON.stringify(product, null, 2));
}

checkOrders();
