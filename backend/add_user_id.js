require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function migrate() {
  const { error } = await supabase.rpc('execute_sql', { sql_query: "ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS user_id uuid;" });
  if (error) {
     console.log("RPC failed, we can't alter table from JS without a function. Fallback to ilike or ask user.");
     console.log(error);
  }
}
migrate();
