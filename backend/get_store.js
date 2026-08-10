require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data } = await supabase.from('stores').select('id, name');
  console.log(data.filter(s => s.name.toLowerCase().includes('jose')));
}
run();
