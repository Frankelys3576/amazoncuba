const fs = require('fs');

const ip = "192.168.12.222";
const base = `http://${ip}:5001/images`;

const categoriesData = [
  { img: 'laptop.jpg', catId: 2, name: 'Laptop', desc: 'Laptop de alto rendimiento', priceBase: 600, storeId: 1 },
  { img: 'monitor.jpg', catId: 2, name: 'Monitor', desc: 'Pantalla de alta resolucion', priceBase: 150, storeId: 2 },
  { img: 'teclado.jpg', catId: 2, name: 'Teclado Mecanico', desc: 'Teclado para gaming o programacion', priceBase: 50, storeId: 2 },
  { img: 'raton.jpg', catId: 2, name: 'Raton Inalambrico', desc: 'Raton ergonomico de precision', priceBase: 30, storeId: 2 },
  { img: 'auriculares.jpg', catId: 1, name: 'Auriculares Bluetooth', desc: 'Auriculares con cancelacion de ruido', priceBase: 80, storeId: 1 },
  { img: 'altavoz.jpg', catId: 1, name: 'Altavoz Portatil', desc: 'Altavoz con gran potencia de bajos', priceBase: 45, storeId: 1 },
  { img: 'camara.jpg', catId: 1, name: 'Camara Digital', desc: 'Camara para fotografia profesional', priceBase: 400, storeId: 1 },
  { img: 'reloj.jpg', catId: 1, name: 'Reloj Inteligente', desc: 'Reloj inteligente con monitor de salud', priceBase: 120, storeId: 1 },
  { img: 'funda.jpg', catId: 2, name: 'Funda Protectora', desc: 'Funda de alta resistencia', priceBase: 15, storeId: 2 },
  { img: 'cargador.jpg', catId: 1, name: 'Cargador Rapido', desc: 'Cargador de pared con carga rapida', priceBase: 25, storeId: 2 },
  { img: 'cable.jpg', catId: 2, name: 'Cable USB-C', desc: 'Cable de carga rapida y datos', priceBase: 10, storeId: 2 },
  { img: 'refrigerador.jpg', catId: 4, name: 'Refrigerador Inverter', desc: 'Refrigerador eficiente con ahorro energetico', priceBase: 800, storeId: 4 },
  { img: 'televisor.jpg', catId: 1, name: 'Televisor Smart TV 4K', desc: 'Televisor UHD con aplicaciones integradas', priceBase: 500, storeId: 4 }
];

const brands = ['Samsung', 'Apple', 'LG', 'Sony', 'Philips', 'Logitech', 'Asus', 'Dell', 'HP', 'Lenovo', 'Corsair', 'Razer', 'Bose', 'JBL'];

let sql = `-- 1. Borrar todos los productos existentes y reiniciar IDs
TRUNCATE TABLE public.products CASCADE;
ALTER SEQUENCE products_id_seq RESTART WITH 1;

-- 2. Insertar los 50 productos exactos
INSERT INTO public.products (name, description, price, stock, category_id, store_id, image_url) VALUES \n`;

const products = [];

for (let i = 0; i < 50; i++) {
  // Rotate through our available images/types
  const type = categoriesData[i % categoriesData.length];
  // Select a random brand
  const brand = brands[Math.floor(Math.random() * brands.length)];
  
  // Example: "Samsung Laptop Pro"
  const name = `${brand} ${type.name} Pro X`;
  const desc = `${type.desc}. Modelo exclusivo de ${brand} con la mejor tecnologia. Garantia extendida.`;
  
  // Vary the price
  const price = (type.priceBase * (0.8 + Math.random() * 0.5)).toFixed(2);
  const stock = 5 + Math.floor(Math.random() * 50);
  
  const imgUrl = `${base}/${type.img}`;
  
  products.push(`('${name}', '${desc}', ${price}, ${stock}, ${type.catId}, ${type.storeId}, '${imgUrl}')`);
}

sql += products.join(',\n') + ';\n';

fs.writeFileSync("/Users/frabkelys/.gemini/antigravity/brain/d90f9b0c-882d-4acb-b4d4-61ad7d530e65/seed_50_exact.sql", sql);
console.log("50 products SQL generated.");
