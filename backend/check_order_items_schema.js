require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.from('order_items').select('*').limit(1);
  if (error) {
    console.error(error);
  } else {
    console.log(Object.keys(data[0] || {}));
  }
}
run();
