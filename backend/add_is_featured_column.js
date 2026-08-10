require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.rpc('run_sql', {
    sql_query: "ALTER TABLE products ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;"
  });
  
  if (error && error.message && error.message.includes("Could not find the function")) {
    console.log("No run_sql RPC, creating column using REST API update on a dummy id (won't work for DDL), you must run this query in Supabase console: ALTER TABLE products ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;");
    
    // Instead of RPC, let's just make an artifact and tell the user, OR since we don't have RPC, I will create an artifact with the SQL.
  } else {
    console.log("Result:", error ? error : "Success");
  }
}
run();
