const supabase = require('../config/supabase');

// Obtener todos los productos
const getProducts = async (req, res) => {
  const { storeId, q, category, province, municipality } = req.query;

  try {
    let query = supabase.from('products').select('*');
    if (storeId) query = query.eq('store_id', storeId);
    if (category) query = query.eq('category_id', category);
    if (q) query = query.ilike('name', `%${q}%`);
    
    if (province && municipality) {
      const searchTags = [
        `${province}:${municipality}`,
        `${province}:Toda la provincia`,
        `Toda Cuba:Toda Cuba`
      ];
      query = query.overlaps('delivery_locations', searchTags);
    } else if (province) {
      const searchTags = [
        `${province}:Toda la provincia`,
        `Toda Cuba:Toda Cuba`
      ];
      query = query.overlaps('delivery_locations', searchTags);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Supabase error fetching products:', error.message);
      return res.status(500).json({ error: 'Error fetching products from database' });
    }
    
    res.json(data);
  } catch (error) {
    console.error('Error fetching products:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Obtener un producto por ID
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Supabase error fetching product:', error.message);
      return res.status(500).json({ error: 'Error fetching product from database' });
    }
    
    if (!data) return res.status(404).json({ error: 'Producto no encontrado' });
    
    res.json(data);
  } catch (error) {
    console.error('Error fetching product:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Crear un nuevo producto (solo admins teóricamente)
const createProduct = async (req, res) => {
  try {
    const { name, description, price, stock, category_id, image_url, store_id, province, municipality, delivery_locations, image_url_2, image_url_3, image_url_4, image_url_5 } = req.body;
    
    // Si no mandan delivery_locations, creamos uno básico por retrocompatibilidad
    const locationsArray = delivery_locations || [`${province}:${municipality}`];

    const { data, error } = await supabase
      .from('products')
      .insert([
        { name, description, price, stock, category_id, image_url, store_id, province, municipality, delivery_locations: locationsArray, image_url_2, image_url_3, image_url_4, image_url_5 }
      ])
      .select();

    if (error) throw error;
    
    res.status(201).json(data[0]);
  } catch (error) {
    console.error('Error creating product:', error.message);
    res.status(500).json({ error: 'Error al crear el producto' });
  }
};

module.exports = {
  getProducts,
  getProductById,
  createProduct
};
