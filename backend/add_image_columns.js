const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const query = `
    ALTER TABLE public.products 
    ADD COLUMN IF NOT EXISTS image_url_2 text,
    ADD COLUMN IF NOT EXISTS image_url_3 text,
    ADD COLUMN IF NOT EXISTS image_url_4 text,
    ADD COLUMN IF NOT EXISTS image_url_5 text;
  `;
  try {
    await pool.query(query);
    console.log("Columnas agregadas con éxito.");
  } catch (err) {
    console.error("Error:", err);
  } finally {
    pool.end();
  }
}

run();
