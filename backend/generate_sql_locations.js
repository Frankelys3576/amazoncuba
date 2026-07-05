const fs = require('fs');

const cubaLocations = {
  "La Habana": ["Plaza de la Revolución", "Centro Habana", "La Habana Vieja", "Regla", "La Habana del Este", "Guanabacoa", "San Miguel del Padrón", "Diez de Octubre", "Cerro", "Marianao", "La Lisa", "Boyeros", "Arroyo Naranjo", "Cotorro", "Playa"],
  "Santiago de Cuba": ["Santiago de Cuba", "Contramaestre", "Songo-La Maya", "Palma Soriano", "San Luis", "Guamá", "Segundo Frente", "Tercer Frente", "Mella"],
  "Holguín": ["Holguín", "Banes", "Antilla", "Báguanos", "Cacocum", "Calixto García", "Cueto", "Frank País", "Gibara", "Mayarí", "Moa", "Rafael Freyre", "Sagua de Tánamo", "Urbano Noris"],
  "Camagüey": ["Camagüey", "Florida", "Nuevitas", "Vertientes", "Minas", "Guáimaro", "Sibanicú", "Santa Cruz del Sur", "Esmeralda", "Sierra de Cubitas", "Jimaguayú", "Najasa", "Carlos Manuel de Céspedes"],
  "Pinar del Río": ["Pinar del Río", "Consolación del Sur", "San Juan y Martínez", "San Luis", "Sandino", "Mantua", "Minas de Matahambre", "Viñales", "La Palma", "Los Palacios", "Guane"],
  "Artemisa": ["Artemisa", "Bauta", "San Antonio de los Baños", "Guanajay", "Mariel", "Caimito", "Alquízar", "Güira de Melena", "Bahía Honda", "Candelaria", "San Cristóbal"],
  "Mayabeque": ["San José de las Lajas", "Güines", "Santa Cruz del Norte", "Madruga", "Jaruco", "Bejucal", "Batabanó", "Quivicán", "Melena del Sur", "Nueva Paz", "San Nicolás"],
  "Matanzas": ["Matanzas", "Cárdenas", "Varadero", "Colón", "Jagüey Grande", "Jovellanos", "Limonar", "Martí", "Pedro Betancourt", "Perico", "Los Arabos", "Unión de Reyes", "Ciénaga de Zapata"],
  "Villa Clara": ["Santa Clara", "Sagua la Grande", "Placetas", "Camajuaní", "Remedios", "Caibarién", "Ranchuelo", "Manicaragua", "Santo Domingo", "Quemado de Güines", "Encrucijada", "Cifuentes", "Corralillo"],
  "Cienfuegos": ["Cienfuegos", "Aguada de Pasajeros", "Rodas", "Palmira", "Lajas", "Cruces", "Cumanayagua", "Abreus"],
  "Sancti Spíritus": ["Sancti Spíritus", "Trinidad", "Cabaiguán", "Yaguajay", "Jatibonico", "Taguasco", "Fomento", "La Sierpe"],
  "Ciego de Ávila": ["Ciego de Ávila", "Morón", "Chambas", "Ciro Redondo", "Majagua", "Florencia", "Venezuela", "Baraguá", "Bolivia", "Primero de Enero"],
  "Las Tunas": ["Las Tunas", "Puerto Padre", "Amancio", "Colombia", "Jesús Menéndez", "Jobabo", "Majibacoa", "Manatí"],
  "Granma": ["Bayamo", "Manzanillo", "Jiguaní", "Cauto Cristo", "Río Cauto", "Yara", "Guisa", "Buey Arriba", "Bartolomé Masó", "Campechuela", "Media Luna", "Niquero", "Pilón"],
  "Guantánamo": ["Guantánamo", "Baracoa", "El Salvador", "Manuel Tames", "Yateras", "San Antonio del Sur", "Imías", "Maisí", "Caimanera", "Niceto Pérez"],
  "Isla de la Juventud": ["Nueva Gerona", "La Fe", "La Demajagua"]
};

const provinces = Object.keys(cubaLocations);

let sql = "-- Actualizar ubicaciones de productos aleatoriamente\n\n";

for (let i = 1; i <= 150; i++) {
  const prov = provinces[Math.floor(Math.random() * provinces.length)];
  const muns = cubaLocations[prov];
  const mun = muns[Math.floor(Math.random() * muns.length)];
  sql += `UPDATE public.products SET province = '${prov}', municipality = '${mun}' WHERE id = ${i};\n`;
}

// Generamos también unas específicas para poder probar con éxito
// Productos del 1 al 10 en La Habana, Centro Habana
for (let i = 1; i <= 10; i++) {
  sql += `UPDATE public.products SET province = 'La Habana', municipality = 'Centro Habana' WHERE id = ${i};\n`;
}

// Productos del 11 al 20 en Matanzas, Varadero
for (let i = 11; i <= 20; i++) {
  sql += `UPDATE public.products SET province = 'Matanzas', municipality = 'Varadero' WHERE id = ${i};\n`;
}

fs.writeFileSync("/Users/frabkelys/.gemini/antigravity/brain/d90f9b0c-882d-4acb-b4d4-61ad7d530e65/assign_locations.sql", sql);
console.log("SQL local locations generated.");
