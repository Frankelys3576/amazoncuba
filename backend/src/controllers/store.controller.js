const supabase = require('../config/supabase');

// Obtener todas las tiendas
const getStores = async (req, res) => {
  try {
    let query = supabase.from('stores').select('*');
    
    // Si se pasa un type por query string, filtramos (ej. type=business)
    if (req.query.type) {
      query = query.eq('store_type', req.query.type);
    }
    
    const { data, error } = await query;

    if (error) {
      console.error('Supabase error fetching stores:', error.message);
      return res.status(500).json({ error: 'Error fetching stores from database' });
    }
    
    res.json(data);
  } catch (error) {
    console.error('Error fetching stores:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Obtener una tienda por ID
const getStoreById = async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Supabase error fetching store:', error.message);
      return res.status(500).json({ error: 'Error fetching store from database' });
    }
    
    if (!data) return res.status(404).json({ error: 'Tienda no encontrada' });
    
    res.json(data);
  } catch (error) {
    console.error('Error fetching store:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Actualizar el estado de una tienda
const updateStoreStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const { data, error } = await supabase
      .from('stores')
      .update({ status })
      .eq('id', id)
      .select();

    if (error) {
      console.error('Supabase error updating store:', error.message);
      return res.status(500).json({ error: 'Error updating store in database' });
    }
    
    if (!data || data.length === 0) return res.status(404).json({ error: 'Tienda no encontrada' });
    
    res.json(data[0]);
  } catch (error) {
    console.error('Error updating store:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Actualizar el perfil de la tienda (para el panel del vendedor)
const updateStoreProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, slogan, phone, logo_url, banner_url } = req.body;
    
    // Preparar objeto de actualización solo con los campos provistos
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (slogan !== undefined) updates.slogan = slogan;
    if (phone !== undefined) updates.phone = phone;
    if (logo_url !== undefined) updates.logo_url = logo_url;
    if (banner_url !== undefined) updates.banner_url = banner_url;
    
    // Si no hay nada que actualizar
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    const { data, error } = await supabase
      .from('stores')
      .update(updates)
      .eq('id', id)
      .select();

    if (error) {
      console.error('Supabase error updating store profile:', error.message);
      return res.status(500).json({ error: 'Error updating store in database' });
    }
    
    if (!data || data.length === 0) return res.status(404).json({ error: 'Tienda no encontrada' });
    
    res.json(data[0]);
  } catch (error) {
    console.error('Error updating store profile:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getStores,
  getStoreById,
  updateStoreStatus,
  updateStoreProfile
};
