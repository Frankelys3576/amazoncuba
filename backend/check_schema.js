require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  const { data, error } = await supabase.rpc('get_store_columns', {}); // this might fail if not exist
  const { data: storeInfo, error: err } = await supabase.from('stores').select('*').limit(1);
  if (err) console.error(err);
  console.log(Object.keys(storeInfo[0]));
}

checkSchema();
