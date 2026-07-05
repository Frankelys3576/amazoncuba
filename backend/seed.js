require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// We need a store_id for these products. Let's assume store_id is nullable or we get the first store.
async function getStoreId() {
  const { data, error } = await supabase.from('stores').select('id').limit(1);
  if (error) {
    console.error('Error fetching store:', error);
    return null;
  }
  if (data && data.length > 0) {
    return data[0].id;
  }
  return null;
}

const categories = [
  { id: 1, name: 'Electrónica', images: [
    'https://m.media-amazon.com/images/I/71z-aTzR2wL._AC_SX679_.jpg',
    'https://m.media-amazon.com/images/I/61K5-N4N1rL._AC_SX679_.jpg',
    'https://m.media-amazon.com/images/I/61B84Iv1jJL._AC_SX679_.jpg',
    'https://m.media-amazon.com/images/I/61M9B4zF7bL._AC_SX679_.jpg'
  ]},
  { id: 2, name: 'Computadoras y Accesorios', images: [
    'https://m.media-amazon.com/images/I/71jG+e7roIG._AC_SX679_.jpg',
    'https://m.media-amazon.com/images/I/81B8X40-RFL._AC_SX679_.jpg',
    'https://m.media-amazon.com/images/I/61+9fK72b6L._AC_SX679_.jpg',
    'https://m.media-amazon.com/images/I/71OQ1e8z02L._AC_SX679_.jpg'
  ]},
  { id: 3, name: 'Belleza y Cuidado Personal', images: [
    'https://m.media-amazon.com/images/I/51w7wK8kEKL._SX679_.jpg',
    'https://m.media-amazon.com/images/I/61U0j1+OaIL._SX679_.jpg',
    'https://m.media-amazon.com/images/I/61B84Iv1jJL._AC_SX679_.jpg'
  ]},
  { id: 4, name: 'Hogar y Cocina', images: [
    'https://m.media-amazon.com/images/I/71vJv5HwYLL._AC_SX679_.jpg',
    'https://m.media-amazon.com/images/I/71Xm+p17B2L._AC_SX679_.jpg',
    'https://m.media-amazon.com/images/I/81xU-V-12PL._AC_SX679_.jpg'
  ]},
  { id: 5, name: 'Juguetes y Juegos', images: [
    'https://m.media-amazon.com/images/I/71g2R1yP03L._AC_SX679_.jpg',
    'https://m.media-amazon.com/images/I/81VdZqT2H5L._AC_SX679_.jpg',
    'https://m.media-amazon.com/images/I/71S50X16WGL._AC_SX679_.jpg'
  ]},
  { id: 6, name: 'Salud y Cuidado Personal', images: [
    'https://m.media-amazon.com/images/I/61p-LqZ6zNL._AC_SX679_.jpg',
    'https://m.media-amazon.com/images/I/61S-iEaI2ZL._AC_SX679_.jpg'
  ]},
  { id: 7, name: 'Para tu Mascota', images: [
    'https://m.media-amazon.com/images/I/71V23s7k1EL._AC_SX679_.jpg',
    'https://m.media-amazon.com/images/I/71D9ImsvEtL._AC_SX679_.jpg'
  ]},
  { id: 8, name: 'Fitness', images: [
    'https://m.media-amazon.com/images/I/71Z+v57s+IL._AC_SX679_.jpg',
    'https://m.media-amazon.com/images/I/61v5e8R4a1L._AC_SX679_.jpg'
  ]}
];

const adjectives = ["Premium", "Pro", "Ultra", "Avanzado", "Profesional", "Inalámbrico", "Inteligente", "Portátil", "Compacto", "Resistente"];
const brandNames = ["Samsung", "Apple", "Sony", "LG", "Logitech", "Philips", "Bose", "Anker", "JBL", "Corsair"];
const productTypes = ["Auriculares", "Reloj", "Teclado", "Ratón", "Cargador", "Altavoz", "Cámara", "Monitor", "Funda", "Cable"];

function generateRandomProduct(categoryId, storeId, catImages) {
  const brand = brandNames[Math.floor(Math.random() * brandNames.length)];
  const type = productTypes[Math.floor(Math.random() * productTypes.length)];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  
  const name = `${brand} ${type} ${adj} - Edición 2026, Alta Calidad`;
  const description = `Este increíble ${type.toLowerCase()} cuenta con la tecnología más avanzada de ${brand}. Su diseño ${adj.toLowerCase()} lo hace perfecto para cualquier ocasión. Garantía de 1 año.`;
  const price = (Math.random() * 190 + 9.99).toFixed(2);
  const stock = Math.floor(Math.random() * 100) + 1;
  const image_url = catImages[Math.floor(Math.random() * catImages.length)] || "https://m.media-amazon.com/images/I/61K5-N4N1rL._AC_SX679_.jpg";
  
  return {
    name,
    description,
    price: parseFloat(price),
    stock,
    category_id: categoryId,
    store_id: storeId,
    image_url
  };
}

async function seedProducts() {
  const storeId = await getStoreId();
  if (!storeId) {
    console.log("No store found. Ensure you have at least one store in the 'stores' table.");
    // We can continue if store_id is nullable, let's try.
  }

  const productsToInsert = [];
  
  // 15 products per category (8 categories * 15 = 120 products)
  for (let c of categories) {
    for (let i = 0; i < 15; i++) {
      productsToInsert.push(generateRandomProduct(c.id, storeId, c.images));
    }
  }

  console.log(`Inserting ${productsToInsert.length} products...`);
  
  // Insert in chunks of 50 to avoid any limits
  for (let i = 0; i < productsToInsert.length; i += 50) {
    const chunk = productsToInsert.slice(i, i + 50);
    const { data, error } = await supabase.from('products').insert(chunk);
    if (error) {
      console.error('Error inserting chunk:', error);
    } else {
      console.log(`Inserted chunk ${i/50 + 1}`);
    }
  }
  
  console.log("Seed completed!");
}

seedProducts();
