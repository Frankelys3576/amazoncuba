require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixPhone() {
  const { data, error } = await supabase
    .from('stores')
    .update({ phone: '52503024' })
    .eq('id', 21);

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Teléfono actualizado exitosamente.');
  }
}

fixPhone();
