require('dotenv').config();
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.SUPABASE_DB_URL });
client.connect()
  .then(() => client.query('ALTER TABLE public.orders ADD COLUMN customer_phone text;'))
  .then(() => { console.log('Column added successfully'); client.end(); })
  .catch(err => { console.error('Error adding column', err); client.end(); });
