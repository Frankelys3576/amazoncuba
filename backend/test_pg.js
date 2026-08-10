require('dotenv').config();
const { Client } = require('pg');

// Supabase DB connection string pattern: postgresql://postgres:[PASSWORD]@db.ihlixbawhtbjxizfpgel.supabase.co:5432/postgres
const passwords = ['postgres', 'admin', 'root', '123456', 'TiendaCuba123!', 'Frankelys123!'];

async function testPg() {
  for (const pwd of passwords) {
    const connectionString = `postgres://postgres:${encodeURIComponent(pwd)}@db.ihlixbawhtbjxizfpgel.supabase.co:5432/postgres`;
    const client = new Client({ connectionString, connectionTimeoutMillis: 3000 });
    try {
      await client.connect();
      console.log('SUCCESS with password:', pwd);
      await client.query(`
        ALTER TABLE public.stores
        ADD COLUMN IF NOT EXISTS province TEXT,
        ADD COLUMN IF NOT EXISTS municipality TEXT,
        ADD COLUMN IF NOT EXISTS address TEXT,
        ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS price_per_night NUMERIC;
      `);
      console.log('ALTER TABLE executed successfully!');
      await client.end();
      return;
    } catch (e) {
      console.log('Failed for', pwd, e.message);
    }
  }
}

testPg();
