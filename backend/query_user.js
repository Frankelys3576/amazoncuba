require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function findUser() {
  const { data: users, error } = await supabase.auth.admin.listUsers();
  if (error) console.error(error);
  
  const user = users.users.find(u => u.email && u.email.includes('52503024'));
  console.log("User:", user ? user.email : "Not found");
  
  const { data: stores } = await supabase.from('stores').select('id, name, phone, store_number');
  const store = stores.find(s => s.phone && s.phone.includes('52503024'));
  console.log("Store:", store);
}

findUser();
