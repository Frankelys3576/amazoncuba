require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function findStore() {
  const { data, error } = await supabase
    .from('stores')
    .select('id, name, store_number')
    .eq('phone', '52503024');

  if (error) console.error(error);
  console.log(data);
}

findStore();
