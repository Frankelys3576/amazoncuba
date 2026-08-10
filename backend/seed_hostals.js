require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const newHostals = [
  {
    name: 'Villa Viñales Paradise',
    store_type: 'hostal',
    status: 'approved',
    phone: '5358765432',
    description: 'Acogedora villa entre los mogotes de Viñales. Excursiones a caballo por los valles de tabaco, piscina privada, terraza panorámica y los mejores desayunos naturales.',
    slogan: 'Tu refugio natural en los valles de Viñales',
    logo_url: 'https://images.unsplash.com/photo-1540541338287-41700207dee6?w=200',
    banner_url: 'https://images.unsplash.com/photo-1540541338287-41700207dee6?w=800',
    is_open: true,
    has_delivery: true,
    opening_time: '08:00',
    closing_time: '22:00',
    slug: 'villa-vinales-paradise',
    zelle_info: {
      province: 'Pinar del Río',
      municipality: 'Viñales',
      address: 'Calle Adela Azcuy Norte #14, Viñales',
      lat: 22.6186,
      lng: -83.7058,
      price_per_night: 45
    }
  },
  {
    name: 'Hostal Colonial Trinidad',
    store_type: 'hostal',
    status: 'approved',
    phone: '5359876543',
    description: 'Casona histórica de estilo colonial del siglo XVIII con patio interior español y techos de tejas en el Centro Histórico de Trinidad. A solo 10 minutos de Playa Ancón.',
    slogan: 'Vive la historia colonial en Trinidad',
    logo_url: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=200',
    banner_url: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800',
    is_open: true,
    has_delivery: false,
    opening_time: '07:00',
    closing_time: '23:00',
    slug: 'hostal-colonial-trinidad',
    zelle_info: {
      province: 'Sancti Spíritus',
      municipality: 'Trinidad',
      address: 'Calle Real del Jigüe #45, Trinidad',
      lat: 21.8052,
      lng: -79.9822,
      price_per_night: 50
    }
  },
  {
    name: 'Casa Particular Baracoa Bay',
    store_type: 'hostal',
    status: 'approved',
    phone: '5351239876',
    description: 'Hospedaje costero frente a la Bahía de Baracoa y con vista al Yunque. Especialidad en gastronomía local tradicional con leche de coco y pescado fresco.',
    slogan: 'Frente al mar en la Primada de Cuba',
    logo_url: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=200',
    banner_url: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800',
    is_open: true,
    has_delivery: true,
    opening_time: '08:00',
    closing_time: '21:00',
    slug: 'casa-baracoa-bay',
    zelle_info: {
      province: 'Guantánamo',
      municipality: 'Baracoa',
      address: 'Malecón #88 e/ Ciro Frías y Pelayo Cuervo',
      lat: 20.3475,
      lng: -74.4961,
      price_per_night: 38
    }
  },
  {
    name: 'Villa Guanabo Beach Resort',
    store_type: 'hostal',
    status: 'approved',
    phone: '5353456789',
    description: 'Villa vacacional de 3 habitaciones con piscina privada, parrillada BBQ y parqueo para varios autos en Guanabo, La Habana. Ideal para vacaciones familiares o en grupo.',
    slogan: 'Sol, playa y piscina en Guanabo',
    logo_url: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=200',
    banner_url: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800',
    is_open: true,
    has_delivery: false,
    opening_time: '09:00',
    closing_time: '22:00',
    slug: 'villa-guanabo-beach-resort',
    zelle_info: {
      province: 'La Habana',
      municipality: 'La Habana del Este',
      address: 'Avenida 5ta #4802, Guanabo',
      lat: 23.1706,
      lng: -82.1286,
      price_per_night: 80
    }
  },
  {
    name: 'Hostal El Balcón de Santiago',
    store_type: 'hostal',
    status: 'approved',
    phone: '5354567890',
    description: 'Hostal con impresionante balcón panorámico hacia la Bahía de Santiago y la ciudad histórica. Climatización total, Wifi y terraza lounge para cócteles cubanos.',
    slogan: 'La mejor vista de Santiago de Cuba',
    logo_url: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=200',
    banner_url: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800',
    is_open: true,
    has_delivery: false,
    opening_time: '08:00',
    closing_time: '23:00',
    slug: 'hostal-balcon-santiago',
    zelle_info: {
      province: 'Santiago de Cuba',
      municipality: 'Santiago de Cuba',
      address: 'Calle Heredia #302, Santiago de Cuba',
      lat: 20.0208,
      lng: -75.8294,
      price_per_night: 40
    }
  }
];

async function seedHostals() {
  console.log('Seeding test hostals into Supabase...');

  for (const hostal of newHostals) {
    const storeNumber = Math.floor(100000 + Math.random() * 900000).toString();
    const storeData = {
      ...hostal,
      store_number: storeNumber
    };

    const { data, error } = await supabase
      .from('stores')
      .insert([storeData])
      .select();

    if (error) {
      console.error(`Error inserting ${hostal.name}:`, error.message);
    } else {
      console.log(`Inserted ${hostal.name} successfully (ID: ${data[0].id}).`);
    }
  }
}

seedHostals();
