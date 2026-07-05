require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateUrls() {
  console.log("Fetching all products...");
  const { data: products, error } = await supabase.from('products').select('id, image_url');
  
  if (error) {
    console.error("Error fetching products:", error);
    return;
  }
  
  console.log(`Found ${products.length} products. Updating URLs...`);
  
  for (const product of products) {
    if (product.image_url && product.image_url.includes('http://192.168.12.222:5001')) {
      const newUrl = product.image_url.replace('http://192.168.12.222:5001', '');
      
      const { error: updateError } = await supabase
        .from('products')
        .update({ image_url: newUrl })
        .eq('id', product.id);
        
      if (updateError) {
        console.error(`Failed to update product ${product.id}:`, updateError);
      }
    }
  }
  
  console.log("Products updated.");
  
  // Now update stores
  console.log("Fetching all stores...");
  const { data: stores, error: storesError } = await supabase.from('stores').select('id, logo_url, banner_url');
  
  if (storesError) {
    console.error("Error fetching stores:", storesError);
    return;
  }
  
  console.log(`Found ${stores.length} stores. Updating URLs...`);
  
  for (const store of stores) {
    let updates = {};
    if (store.logo_url && store.logo_url.includes('http://192.168.12.222:5001')) {
      updates.logo_url = store.logo_url.replace('http://192.168.12.222:5001', '');
    }
    if (store.banner_url && store.banner_url.includes('http://192.168.12.222:5001')) {
      updates.banner_url = store.banner_url.replace('http://192.168.12.222:5001', '');
    }
    
    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from('stores')
        .update(updates)
        .eq('id', store.id);
        
      if (updateError) {
        console.error(`Failed to update store ${store.id}:`, updateError);
      }
    }
  }
  
  console.log("Stores updated. All done!");
}

updateUrls();
