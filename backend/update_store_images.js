require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const imageMap = {
  'Spaguettis': 'https://images.unsplash.com/photo-1621996311239-5ce504bf075b?auto=format&fit=crop&w=800&q=80',
  'Pescado': 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=800&q=80',
  'Fricasé de Pollo': 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=800&q=80',
  'Pollo al Curry': 'https://images.unsplash.com/photo-1565557612115-4ba972ce667b?auto=format&fit=crop&w=800&q=80',
  'Pollo': 'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?auto=format&fit=crop&w=800&q=80',
  'Cerdo': 'https://images.unsplash.com/photo-1544025162-8111f422c5e5?auto=format&fit=crop&w=800&q=80',
  'Arroz Frito': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=800&q=80',
  'Arroz Imperial': 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=800&q=80',
  'Arroz': 'https://images.unsplash.com/photo-1536304929831-ee1ca9d44906?auto=format&fit=crop&w=800&q=80',
  'Sopa': 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=800&q=80',
  'Crema': 'https://images.unsplash.com/photo-1604152006599-47ea37704df3?auto=format&fit=crop&w=800&q=80',
  'Tostones': 'https://images.unsplash.com/photo-1628294895950-9805252327bc?auto=format&fit=crop&w=800&q=80',
  'Chicharritas': 'https://images.unsplash.com/photo-1599490659213-e2b9527bd087?auto=format&fit=crop&w=800&q=80',
  'Empaque': 'https://images.unsplash.com/photo-1584916201218-f4242ceb4809?auto=format&fit=crop&w=800&q=80'
};

async function updateImages() {
  const { data: products, error } = await supabase.from('products').select('*').eq('store_id', 21);
  if (error) {
    console.error("Fetch error:", error);
    return;
  }
  
  for (const product of products) {
    let newImage = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80';
    
    for (const [key, url] of Object.entries(imageMap)) {
      if (product.name.toLowerCase().includes(key.toLowerCase())) {
        newImage = url;
        break; // Match first, most specific if ordered correctly
      }
    }
    
    await supabase.from('products').update({ image_url: newImage }).eq('id', product.id);
    console.log(`Updated ${product.name}`);
  }
  console.log("Done");
}

updateImages();
