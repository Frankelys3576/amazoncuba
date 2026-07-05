const fs = require("fs");

let sql = "";
const ip = "192.168.12.222";
const base = `http://${ip}:5001/images`;

const rules = [
  { keyword: 'Laptop', img: 'laptop.jpg' },
  { keyword: 'Teclado', img: 'teclado.jpg' },
  { keyword: 'Raton', img: 'raton.jpg' },
  { keyword: 'Auriculares', img: 'auriculares.jpg' },
  { keyword: 'Monitor', img: 'monitor.jpg' },
  { keyword: 'Altavoz', img: 'altavoz.jpg' },
  { keyword: 'Camara', img: 'camara.jpg' },
  { keyword: 'Reloj', img: 'reloj.jpg' },
  { keyword: 'Funda', img: 'funda.jpg' },
  { keyword: 'Cargador', img: 'cargador.jpg' },
  { keyword: 'Cable', img: 'cable.jpg' },
  { keyword: 'Refrigerador', img: 'refrigerador.jpg' },
  { keyword: 'Televisor', img: 'televisor.jpg' }
];

// Asignar una imagen por defecto para los que no tengan regla (ej: otros)
sql += `UPDATE public.products SET image_url = '${base}/cat1.jpg';\n\n`;

// Asignar basandose en el nombre del producto
rules.forEach(rule => {
  sql += `UPDATE public.products SET image_url = '${base}/${rule.img}' WHERE name ILIKE '%${rule.keyword}%';\n`;
});

// Arreglar casos especiales de los datos base
sql += `UPDATE public.products SET image_url = '${base}/televisor.jpg' WHERE name ILIKE '%Smart TV%';\n`;
sql += `UPDATE public.products SET image_url = '${base}/reloj.jpg' WHERE name ILIKE '%Pulsera%';\n`;
sql += `UPDATE public.products SET image_url = '${base}/auriculares.jpg' WHERE name ILIKE '%WH-1000XM4%';\n`;
sql += `UPDATE public.products SET image_url = '${base}/camara.jpg' WHERE name ILIKE '%Lente%';\n`;

fs.writeFileSync("/Users/frabkelys/.gemini/antigravity/brain/d90f9b0c-882d-4acb-b4d4-61ad7d530e65/update_images_smart.sql", sql);
console.log("SQL smart images generated.");
