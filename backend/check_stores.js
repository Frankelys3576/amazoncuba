require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStores() {
  const { data, error } = await supabase.from('stores').select('*');
  if (error) {
    console.error("Error:", error);
  } else {
    console.log(`Found ${data.length} stores.`);
    if (data.length > 0) {
      console.log(data.map(s => s.name).join(', '));
    }
  }
}

checkStores();
