const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabase = createClient(
  'https://ihlixbawhtbjxizfpgel.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlobGl4YmF3aHRianhpemZwZ2VsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzI0NjI5NSwiZXhwIjoyMDk4ODIyMjk1fQ.nvIx9_kNQWVg2eQEcO4y_akFpY7qRqOLFZkTBryizTI'
);

const seedStore = async () => {
  try {
    const phone = '52503024';
    const password = '12345678';
    const hashedPassword = await bcrypt.hash(password, 10);

    console.log('Using existing seller...');
    const sellerId = 'ab637874-5c51-4242-8e77-2720505ea476';

    // 2. Create store
    console.log('Creating store...');
    const storeInfo = {
      name: 'San Jose#45',
      description: '🍱 Combos, completas, arroces, pastas, ensaladas, sopas y más. ¡Llevamos el sabor directo a su puerta! Cerramos recepción de pedidos 8:00 PM.',
      status: 'approved',
      store_type: 'business',
      phone: phone,
      logo_url: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=500&q=80',
      banner_url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1000&q=80'
    };

    const { data: storeData, error: storeError } = await supabase
      .from('stores')
      .insert([storeInfo])
      .select();

    if (storeError) throw storeError;
    const storeId = storeData[0].id;
    console.log('Store created, ID:', storeId);

    // Get categories to find food
    const { data: cats } = await supabase.from('categories').select('*');
    let categoryId = cats && cats.length > 0 ? cats[0].id : 1;
    const foodCat = cats.find(c => c.name.toLowerCase().includes('comida') || c.name.toLowerCase().includes('alimento') || c.name.toLowerCase().includes('gastronom'));
    if (foodCat) categoryId = foodCat.id;

    // 3. Create products
    const rawProducts = [
      { n: "Filete de Pescado de Mar (Con arroz blanco)", d: "(Salsa catalana, Grillé, Salsa de Ajo) Incluyen guarnición de arroz, ensalada y vianda frita.", p: 2000 },
      { n: "Filete de Pescado de Mar (Con arroz frito o amarillo)", d: "(Salsa catalana, Grillé, Salsa de Ajo) Incluyen guarnición, ensalada y vianda frita.", p: 2400 },
      { n: "Aporreado de Pescado de Mar (Con arroz blanco)", d: "Incluyen guarnición de arroz, ensalada y vianda frita.", p: 2000 },
      { n: "Aporreado de Pescado de Mar (Con arroz frito o amarillo)", d: "Incluyen guarnición de arroz, ensalada y vianda frita.", p: 2400 },
      { n: "Filete de Pescado de Mar al Curry (con arroz blanco)", d: "Incluyen guarnición de arroz, ensalada y vianda frita.", p: 2000 },
      { n: "Filete de Pescado de Mar al Curry (con arroz frito o amarillo)", d: "Incluyen guarnición de arroz, ensalada y vianda frita.", p: 2400 },
      { n: "Fricasé de Pollo (Con arroz frito o arroz amarillo)", d: "Incluyen guarnición, ensalada y vianda frita.", p: 2400 },
      { n: "Fricasé de Pollo (Con arroz blanco)", d: "Incluyen guarnición, ensalada y vianda frita.", p: 2000 },
      { n: "Pollo al Curry (Con arroz frito o arroz amarillo)", d: "Incluyen guarnición, ensalada y vianda frita.", p: 2400 },
      { n: "Pollo al Curry (Con arroz blanco)", d: "Incluyen guarnición, ensalada y vianda frita.", p: 2000 },
      { n: "Cerdo al Curry (con arroz amarillo o arroz frito)", d: "Incluyen guarnición, ensalada y vianda frita.", p: 2400 },
      { n: "Cerdo al curry (con arroz blanco)", d: "Incluyen guarnición, ensalada y vianda frita.", p: 2000 },
      { n: "Arroz Frito con Bistec de Cerdo / Pollo deshuesado", d: "Incluyen guarnición, ensalada y vianda frita.", p: 2000 },
      { n: "Arroz Amarillo con Bistec de Cerdo / Pollo deshuesado", d: "Incluyen guarnición, ensalada y vianda frita.", p: 2000 },
      { n: "Arroz blanco con Bistec de Cerdo", d: "Incluyen guarnición, ensalada y vianda frita.", p: 1500 },
      { n: "Arroz blanco con Pollo Deshuesado", d: "Incluyen guarnición, ensalada y vianda frita.", p: 1500 },
      { n: "Arroz Frito (Sencillo)", d: "Incluyen guarnición, ensalada y vianda frita.", p: 1300 },
      { n: "Arroz vegetariano salteado con vegetales", d: "Ración de arroz.", p: 900 },
      { n: "Arroz vegetariano salteado con vegetales y Salsa Soya", d: "Ración de arroz.", p: 1100 },
      { n: "Arroz Imperial (Por ración)", d: "(Mínimo a encargar: 4 raciones). Debe realizarse con 24 horas de antelación.", p: 2000 },
      { n: "Spaguettis Bechamel + Bacon", d: "Pastas frescas.", p: 1600 },
      { n: "Spaguettis Bechamel", d: "Pastas frescas.", p: 1500 },
      { n: "Spaguettis con Bacon (Salsa Roja)", d: "Pastas frescas.", p: 1500 },
      { n: "Spaguettis Hawaiana", d: "Pastas frescas.", p: 1500 },
      { n: "Spaquettis con Chorizo y Queso", d: "Pastas frescas.", p: 1200 },
      { n: "Spaquettis con Salchicha y Queso", d: "Pastas frescas.", p: 1200 },
      { n: "Spaquettis Napolitanos", d: "Pastas frescas.", p: 1200 },
      { n: "Fideos Salteados con Carne y Vegetales", d: "Pastas frescas.", p: 1500 },
      { n: "Spaquettis Vegetarianos Salteados con Salsa Soya", d: "Pastas frescas.", p: 1400 },
      { n: "Vegetales de estación (Natural sencilla/Mixta)", d: "Incluye termopacks 450 ml.", p: 500 },
      { n: "Vegetales de estación Mixta aliñadas", d: "Con Salsa mayonesa, aceite de oliva, vinagre balsámico. Incluye termopacks 450 ml.", p: 800 },
      { n: "Sopa de Pollo", d: "Raciones de 450ml. Incluye el termopack.", p: 650 },
      { n: "Crema de queso", d: "Raciones de 450ml. Incluye el termopack.", p: 650 },
      { n: "Crema Virginia (Jamón y queso)", d: "Raciones de 450ml. Incluye el termopack.", p: 650 },
      { n: "Crema Aurora (Salsa Roja)", d: "Raciones de 450ml. Incluye el termopack.", p: 650 },
      { n: "Chicharritas (Guarnición)", d: "Incluye termopacks 450ml.", p: 500 },
      { n: "Tostones (Guarnición)", d: "Incluye termopacks 450ml.", p: 600 },
      { n: "Ración extra (12 onzas) de arroz blanco", d: "Guarnición extra.", p: 500 },
      { n: "Ración extra (12 onzas) de arroz amarillo", d: "Guarnición extra.", p: 800 },
      { n: "Ración extra (12 onzas) de arroz frito", d: "Guarnición extra.", p: 800 },
      { n: "Servicio de Empaque en Termopack", d: "¡Mantenemos la calidad y el calor de tu comida hasta el último bocado!", p: 150 }
    ];

    const productsToInsert = rawProducts.map(p => ({
      name: p.n,
      description: p.d,
      price: p.p,
      currency: 'CUP',
      stock: 99,
      category_id: categoryId,
      store_id: storeId,
      image_url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=500&q=80',
      province: 'Ciego de Ávila',
      municipality: 'Ciego de Ávila',
      delivery_locations: ['Ciego de Ávila:Ciego de Ávila', 'Ciego de Ávila:Morón']
    }));

    console.log(`Inserting ${productsToInsert.length} products...`);
    const { error: prodError } = await supabase.from('products').insert(productsToInsert);
    
    if (prodError) throw prodError;
    console.log('✅ Store, Seller and Products successfully created!');
    
  } catch (err) {
    console.error('❌ Error seeding data:', err);
  }
};

seedStore();
