const fs = require("fs");
const categories = [1,2,3,4,5,6,7,8];
const adjectives = ["Premium", "Pro", "Ultra", "Avanzado", "Profesional", "Inalambrico", "Inteligente", "Portatil", "Compacto", "Resistente"];
const brandNames = ["Samsung", "Apple", "Sony", "LG", "Logitech", "Philips", "Bose", "Anker", "JBL", "Corsair"];
const productTypes = ["Auriculares", "Reloj", "Teclado", "Raton", "Cargador", "Altavoz", "Camara", "Monitor", "Funda", "Cable"];
const images = [
    "https://m.media-amazon.com/images/I/71z-aTzR2wL._AC_SX679_.jpg",
    "https://m.media-amazon.com/images/I/61K5-N4N1rL._AC_SX679_.jpg",
    "https://m.media-amazon.com/images/I/61B84Iv1jJL._AC_SX679_.jpg",
    "https://m.media-amazon.com/images/I/71jG+e7roIG._AC_SX679_.jpg",
    "https://m.media-amazon.com/images/I/51w7wK8kEKL._SX679_.jpg",
    "https://m.media-amazon.com/images/I/71vJv5HwYLL._AC_SX679_.jpg",
    "https://m.media-amazon.com/images/I/71g2R1yP03L._AC_SX679_.jpg",
    "https://m.media-amazon.com/images/I/61p-LqZ6zNL._AC_SX679_.jpg"
];

let sql = "INSERT INTO public.products (name, description, price, stock, category_id, store_id, image_url) VALUES \n";
const values = [];

for (let i = 0; i < 120; i++) {
  const brand = brandNames[Math.floor(Math.random() * brandNames.length)];
  const type = productTypes[Math.floor(Math.random() * productTypes.length)];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const cat = categories[Math.floor(Math.random() * categories.length)];
  const img = images[Math.floor(Math.random() * images.length)];
  const price = (Math.random() * 190 + 9.99).toFixed(2);
  const stock = Math.floor(Math.random() * 100) + 1;
  const storeId = 1 + Math.floor(Math.random() * 5);
  
  const name = `${brand} ${type} ${adj} - Edicion 2026`;
  const desc = `Este increible producto cuenta con la tecnologia mas avanzada de ${brand}. Su diseno ${adj.toLowerCase()} lo hace perfecto para cualquier ocasion. Garantia de 1 ano.`;
  
  values.push(`('${name}', '${desc}', ${price}, ${stock}, ${cat}, ${storeId}, '${img}')`);
}

sql += values.join(",\n") + ";\n";

fs.writeFileSync("/Users/frabkelys/.gemini/antigravity/brain/d90f9b0c-882d-4acb-b4d4-61ad7d530e65/seed_products.sql", sql);
console.log("SQL generated properly.");
