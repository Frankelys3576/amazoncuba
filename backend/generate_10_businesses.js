const fs = require('fs');

const ip = "192.168.12.222";
const baseImg = `http://${ip}:5001/images/cat1.jpg`;

let sql = `-- 1. Añadir Nuevas Categorías
INSERT INTO public.categories (name) VALUES 
('Comida y Restaurantes'),
('Hostales y Alojamiento'),
('Talleres y Servicios');

-- 2. Añadir 10 Negocios Nuevos
INSERT INTO public.stores (name, description, logo_url, banner_url, status) VALUES 
('El Rincón del Chef', 'Restaurante de comida criolla e internacional. Excelente sabor y calidad.', '${baseImg}', '${baseImg}', 'approved'),
('Pizzería La Bella', 'Las mejores pizzas de la ciudad, hechas en horno de leña.', '${baseImg}', '${baseImg}', 'approved'),
('Cafetería El Despertar', 'Cafés especiales, desayunos y dulces artesanales.', '${baseImg}', '${baseImg}', 'approved'),
('Hostal Casa Colonial', 'Alojamiento confortable en una casa colonial restaurada. Desayuno incluido.', '${baseImg}', '${baseImg}', 'approved'),
('Hostal Vista al Mar', 'Habitaciones con excelente vista y brisa marina. Confort y tranquilidad.', '${baseImg}', '${baseImg}', 'approved'),
('Residencia Los Pinos', 'Hospedaje económico y seguro para largas y cortas estancias.', '${baseImg}', '${baseImg}', 'approved'),
('Taller Mecánico AutoFix', 'Servicio completo de mecánica automotriz, chapistería y pintura.', '${baseImg}', '${baseImg}', 'approved'),
('Reparaciones Electrónicas', 'Reparación de celulares, laptops y electrodomésticos.', '${baseImg}', '${baseImg}', 'approved'),
('Taller de Costura y Moda', 'Confecciones a medida y arreglos de ropa.', '${baseImg}', '${baseImg}', 'approved'),
('Restaurante Mar y Tierra', 'Especialidad en mariscos y carnes a la parrilla.', '${baseImg}', '${baseImg}', 'approved');

-- 3. Añadir Productos/Servicios a los nuevos negocios
-- Para obtener los IDs correctos dinámicamente, usaremos subconsultas.

INSERT INTO public.products (name, description, price, stock, category_id, store_id, image_url) VALUES 
-- Productos El Rincón del Chef
('Ropa Vieja con Congrí', 'Plato tradicional cubano acompañado de vianda y ensalada.', 12.50, 50, (SELECT id FROM public.categories WHERE name = 'Comida y Restaurantes'), (SELECT id FROM public.stores WHERE name = 'El Rincón del Chef'), '${baseImg}'),
('Pollo Asado Entero', 'Pollo asado a la barbacoa con guarnición.', 15.00, 30, (SELECT id FROM public.categories WHERE name = 'Comida y Restaurantes'), (SELECT id FROM public.stores WHERE name = 'El Rincón del Chef'), '${baseImg}'),

-- Productos Pizzería La Bella
('Pizza Familiar Jamón y Queso', 'Pizza de 8 porciones con doble queso y jamón.', 10.00, 40, (SELECT id FROM public.categories WHERE name = 'Comida y Restaurantes'), (SELECT id FROM public.stores WHERE name = 'Pizzería La Bella'), '${baseImg}'),
('Spaghetti a la Boloñesa', 'Pasta fresca con salsa de carne y queso parmesano.', 8.50, 40, (SELECT id FROM public.categories WHERE name = 'Comida y Restaurantes'), (SELECT id FROM public.stores WHERE name = 'Pizzería La Bella'), '${baseImg}'),

-- Productos Cafetería El Despertar
('Desayuno Completo', 'Huevos, tostadas, jugo natural y café.', 5.00, 100, (SELECT id FROM public.categories WHERE name = 'Comida y Restaurantes'), (SELECT id FROM public.stores WHERE name = 'Cafetería El Despertar'), '${baseImg}'),
('Tarta de Chocolate', 'Porción generosa de tarta casera.', 3.50, 20, (SELECT id FROM public.categories WHERE name = 'Comida y Restaurantes'), (SELECT id FROM public.stores WHERE name = 'Cafetería El Despertar'), '${baseImg}'),

-- Productos Hostal Casa Colonial
('Habitación Doble Estandar', 'Noche en habitación doble con aire acondicionado.', 35.00, 5, (SELECT id FROM public.categories WHERE name = 'Hostales y Alojamiento'), (SELECT id FROM public.stores WHERE name = 'Hostal Casa Colonial'), '${baseImg}'),
('Suite Colonial', 'Habitación premium con balcón y baño privado.', 50.00, 2, (SELECT id FROM public.categories WHERE name = 'Hostales y Alojamiento'), (SELECT id FROM public.stores WHERE name = 'Hostal Casa Colonial'), '${baseImg}'),

-- Productos Hostal Vista al Mar
('Habitación Frente al Mar', 'Alojamiento por noche con vista directa a la playa.', 40.00, 3, (SELECT id FROM public.categories WHERE name = 'Hostales y Alojamiento'), (SELECT id FROM public.stores WHERE name = 'Hostal Vista al Mar'), '${baseImg}'),

-- Productos Taller Mecánico AutoFix
('Mantenimiento Básico (Cambio de Aceite)', 'Incluye aceite, filtro y revisión general.', 45.00, 100, (SELECT id FROM public.categories WHERE name = 'Talleres y Servicios'), (SELECT id FROM public.stores WHERE name = 'Taller Mecánico AutoFix'), '${baseImg}'),
('Diagnóstico Computarizado', 'Lectura de códigos y diagnóstico completo del motor.', 20.00, 100, (SELECT id FROM public.categories WHERE name = 'Talleres y Servicios'), (SELECT id FROM public.stores WHERE name = 'Taller Mecánico AutoFix'), '${baseImg}'),

-- Productos Reparaciones Electrónicas
('Cambio de Pantalla Celular', 'Servicio de reemplazo de display para varios modelos.', 30.00, 50, (SELECT id FROM public.categories WHERE name = 'Talleres y Servicios'), (SELECT id FROM public.stores WHERE name = 'Reparaciones Electrónicas'), '${baseImg}'),
('Mantenimiento a Laptop', 'Limpieza interna y cambio de pasta térmica.', 15.00, 50, (SELECT id FROM public.categories WHERE name = 'Talleres y Servicios'), (SELECT id FROM public.stores WHERE name = 'Reparaciones Electrónicas'), '${baseImg}'),

-- Productos Taller de Costura y Moda
('Arreglo de Pantalón (Ruedo)', 'Ajuste de longitud para pantalones de vestir o jeans.', 3.00, 100, (SELECT id FROM public.categories WHERE name = 'Talleres y Servicios'), (SELECT id FROM public.stores WHERE name = 'Taller de Costura y Moda'), '${baseImg}'),

-- Productos Restaurante Mar y Tierra
('Mariscada para Dos', 'Selección de mariscos frescos a la parrilla.', 28.00, 15, (SELECT id FROM public.categories WHERE name = 'Comida y Restaurantes'), (SELECT id FROM public.stores WHERE name = 'Restaurante Mar y Tierra'), '${baseImg}');
`;

fs.writeFileSync("/Users/frabkelys/.gemini/antigravity/brain/d90f9b0c-882d-4acb-b4d4-61ad7d530e65/add_10_businesses.sql", sql);
console.log("SQL script created for 10 new businesses");
