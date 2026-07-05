require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️ Faltan credenciales de Supabase en el archivo .env');
}

// Inicializamos el cliente de Supabase
// Usamos SERVICE_ROLE_KEY si necesitamos saltarnos RLS (Row Level Security) desde el backend de forma segura
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
