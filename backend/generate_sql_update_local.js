const fs = require("fs");

let sql = "";
const ip = "192.168.12.222";

// Generamos el update para todos los 150 productos
for (let i = 1; i <= 150; i++) {
  const cat = 1 + Math.floor(Math.random() * 8);
  const img = `http://${ip}:5001/images/cat${cat}.jpg`;
  sql += `UPDATE public.products SET image_url = '${img}' WHERE id = ${i};\n`;
}

fs.writeFileSync("/Users/frabkelys/.gemini/antigravity/brain/d90f9b0c-882d-4acb-b4d4-61ad7d530e65/update_images.sql", sql);
console.log("SQL local images generated.");
