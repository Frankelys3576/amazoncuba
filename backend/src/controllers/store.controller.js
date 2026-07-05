const supabase = require('../config/supabase');

// Obtener todas las tiendas
const getStores = async (req, res) => {
  try {
    const { data, error } = await supabase.from('stores').select('*');

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

module.exports = {
  getStores,
  getStoreById
};
