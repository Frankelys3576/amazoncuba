require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function addMoronHostal() {
  console.log('Adding Hostal de Prueba in Morón, Ciego de Ávila...');

  const storeNumber = Math.floor(100000 + Math.random() * 900000).toString();

  const moronHostal = {
    name: 'Hostal de Prueba',
    store_type: 'hostal',
    status: 'approved',
    phone: '5352503024',
    description: 'Hostal de prueba acogedor en el centro de Morón, Ciego de Ávila. Cercano a la cayería norte (Cayo Coco y Cayo Guillermo). Habitaciones privadas con aire acondicionado, Wifi y desayuno.',
    slogan: 'Tu hospedaje de prueba en Morón',
    logo_url: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=200',
    banner_url: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800',
    is_open: true,
    has_delivery: true,
    opening_time: '08:00',
    closing_time: '22:00',
    slug: 'hostal-de-prueba-moron',
    store_number: storeNumber,
    zelle_info: {
      province: 'Ciego de Ávila',
      municipality: 'Morón',
      address: 'Calle Martí #120 e/ Castillo y Libertad, Morón',
      lat: 22.1086,
      lng: -78.6269,
      price_per_night: 40
    }
  };

  const { data, error } = await supabase
    .from('stores')
    .insert([moronHostal])
    .select();

  if (error) {
    console.error('Error inserting Hostal de Prueba:', error.message);
  } else {
    console.log(`Inserted Hostal de Prueba successfully (ID: ${data[0].id}).`);
  }
}

addMoronHostal();
