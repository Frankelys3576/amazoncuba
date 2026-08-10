require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function applyHostalsSchema() {
  console.log('Updating stores for Hostals (CubaBnB)...');

  const { data: stores, error } = await supabase
    .from('stores')
    .select('*');

  if (error) {
    console.error('Error fetching stores:', error);
    return;
  }

  const hostalsData = [
    {
      nameMatch: 'Hostal Casa Colonial',
      province: 'La Habana',
      municipality: 'Habana Vieja',
      address: 'Calle Obispo #254 e/ Habana y Compostela',
      lat: 23.1381,
      lng: -82.3532,
      price_per_night: 35,
      description: 'Hermosa casona colonial del siglo XIX restaurada en el corazón de La Habana Vieja. Habitaciones climatizadas con baño privado y desayuno criollo incluido.'
    },
    {
      nameMatch: 'Hostal Vista al Mar',
      province: 'Matanzas',
      municipality: 'Varadero',
      address: 'Calle 1ra e/ 30 y 31, Varadero',
      lat: 23.1512,
      lng: -81.2584,
      price_per_night: 60,
      description: 'Hostal acogedor a solo 50 metros de la playa de Varadero. Vista panorámica al mar, terraza privada, aire acondicionado y excelente atención personalizada.'
    },
    {
      nameMatch: 'Residencia Los Pinos',
      province: 'Cienfuegos',
      municipality: 'Cienfuegos',
      address: 'Avenida 54 #3302 e/ 33 y 35, Cienfuegos',
      lat: 22.1458,
      lng: -80.4411,
      price_per_night: 42,
      description: 'Residencia moderna cerca del Malecón de Cienfuegos y el Centro Histórico. Cómodas suites con Wifi, parqueo y vista al parque Paseo del Prado.'
    }
  ];

  for (const hData of hostalsData) {
    const store = stores.find(s => s.name.toLowerCase().includes(hData.nameMatch.toLowerCase().split(' ')[1]));
    if (store) {
      console.log(`Setting store_type = 'hostal' for: ${store.name}`);
      const updatedZelleInfo = {
        ...(store.zelle_info || {}),
        province: hData.province,
        municipality: hData.municipality,
        address: hData.address,
        lat: hData.lat,
        lng: hData.lng,
        price_per_night: hData.price_per_night
      };

      const { error: updateError } = await supabase
        .from('stores')
        .update({
          store_type: 'hostal',
          description: hData.description,
          zelle_info: updatedZelleInfo
        })
        .eq('id', store.id);

      if (updateError) {
        console.error(`Error updating store ${store.id}:`, updateError.message);
      } else {
        console.log(`Updated store ${store.name} successfully.`);
      }
    }
  }
}

applyHostalsSchema();
