require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function resetOriginalStores() {
  console.log('Resetting original stores (IDs 9, 10, 11) back to store_type = business...');

  const originalStoreIds = [9, 10, 11];

  for (const id of originalStoreIds) {
    const { data, error } = await supabase
      .from('stores')
      .update({ store_type: 'business' })
      .eq('id', id)
      .select();

    if (error) {
      console.error(`Error resetting store ${id}:`, error.message);
    } else {
      console.log(`Reset store ${data[0].name} (ID: ${id}) to store_type = 'business'.`);
    }
  }
}

resetOriginalStores();
