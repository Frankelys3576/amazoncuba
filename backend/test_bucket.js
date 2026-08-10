require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.storage.getBucket('store-images');
  console.log(data ? 'Bucket exists' : 'Bucket missing or error', error);
}
check();
