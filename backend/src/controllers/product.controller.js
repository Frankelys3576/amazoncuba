const supabase = require('../config/supabase');

// Obtener todos los productos
const getProducts = async (req, res) => {
  const { storeId, q, category, province, municipality, store_category_id } = req.query;

  try {
    let query = supabase.from('products').select('*, stores(accepts_zelle, name, phone, slug)');
    if (storeId) query = query.eq('store_id', storeId);
    if (category) query = query.eq('category_id', category);
    if (store_category_id) query = query.eq('store_category_id', store_category_id);
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
    
    // Sort by featured first, then by creation date
    query = query.order('is_featured', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('Supabase error fetching products:', error.message);
      return res.status(500).json({ error: 'Error fetching products from database' });
    }
    
    const formattedData = (data || []).map(item => ({
      ...item,
      store_accepts_zelle: item.stores ? item.stores.accepts_zelle === true : false,
      store_name: item.store_name || item.stores?.name,
      store_phone: item.store_phone || item.stores?.phone,
      store_slug: item.store_slug || item.stores?.slug || item.stores?.id
    }));

    res.json(formattedData);
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
      .select('*, stores(accepts_zelle, name, phone, slug)')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Supabase error fetching product:', error.message);
      return res.status(500).json({ error: 'Error fetching product from database' });
    }
    
    if (!data) return res.status(404).json({ error: 'Producto no encontrado' });
    
    const formattedData = {
      ...data,
      store_accepts_zelle: data.stores ? data.stores.accepts_zelle === true : false,
      store_name: data.store_name || data.stores?.name,
      store_phone: data.store_phone || data.stores?.phone,
      store_slug: data.store_slug || data.stores?.slug || data.stores?.id
    };

    res.json(formattedData);
  } catch (error) {
    console.error('Error fetching product:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Crear un nuevo producto (solo admins teóricamente)
const createProduct = async (req, res) => {
  try {
    const { name, description, price, price_usd, currency, stock, category_id, store_category_id, image_url, store_id, province, municipality, delivery_locations, image_url_2, image_url_3, image_url_4, image_url_5 } = req.body;
    
    // Si no mandan delivery_locations, creamos uno básico por retrocompatibilidad
    const locationsArray = delivery_locations || [`${province}:${municipality}`];
    // Si no mandan moneda, por defecto es USD
    const productCurrency = currency || 'USD';

    const { data, error } = await supabase
      .from('products')
      .insert([
        { name, description, price, price_usd, currency: productCurrency, stock, category_id, store_category_id, image_url, store_id, province, municipality, delivery_locations: locationsArray, image_url_2, image_url_3, image_url_4, image_url_5 }
      ])
      .select();

    if (error) throw error;
    
    res.status(201).json(data[0]);
  } catch (error) {
    console.error('Error creating product:', error.message);
    res.status(500).json({ error: 'Error al crear el producto' });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    
    // 1. Eliminar referencias en order_items primero
    await supabase
      .from('order_items')
      .delete()
      .eq('product_id', id);

    // 2. Eliminar el producto
    const { data, error } = await supabase
      .from('products')
      .delete()
      .eq('id', id)
      .select();

    if (error) throw error;
    
    res.json({ message: 'Producto eliminado correctamente', product: data ? data[0] : null });
  } catch (error) {
    console.error('Error deleting product:', error.message);
    res.status(500).json({ error: 'Error al eliminar el producto' });
  }
};

const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    
    // Si viene delivery_locations y province/municipality, podemos dejarlos pasar
    // Si no mandan moneda, no la sobreescribimos pero sí nos aseguramos de que no sea null
    if (updateData.currency === null) updateData.currency = 'USD';
    
    // Nos aseguramos que no vengan campos extraños o vacíos que rompan
    delete updateData.id;
    delete updateData.created_at;

    const { data, error } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', id)
      .select();

    if (error) throw error;
    
    res.json(data[0]);
  } catch (error) {
    console.error('Error updating product:', error.message);
    res.status(500).json({ error: 'Error al actualizar el producto' });
  }
};
const registerProductView = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Solo insertamos un registro en product_views, created_at se pone automático por defecto en BD
    const { error } = await supabase
      .from('product_views')
      .insert([{ product_id: id }]);

    if (error) throw error;
    
    res.status(200).json({ message: 'View registered' });
  } catch (error) {
    console.error('Error registering product view:', error.message);
    res.status(500).json({ error: 'Error al registrar la vista' });
  }
};

// Obtener reseñas de un producto
const getProductReviews = async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('product_reviews')
      .select('*')
      .eq('product_id', id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Error fetching reviews:', error.message);
    res.status(500).json({ error: 'Error fetching reviews' });
  }
};

// Añadir una nueva reseña
const addProductReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { customer_name, rating, comment } = req.body;

    if (!customer_name || !rating) {
      return res.status(400).json({ error: 'Name and rating are required' });
    }

    const { data, error } = await supabase
      .from('product_reviews')
      .insert([{ 
        product_id: id,
        customer_name,
        rating,
        comment
      }])
      .select();

    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (error) {
    console.error('Error adding review:', error.message);
    res.status(500).json({ error: 'Error adding review' });
  }
};

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  deleteProduct,
  updateProduct,
  registerProductView,
  getProductReviews,
  addProductReview
};
