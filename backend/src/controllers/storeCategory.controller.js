const supabase = require('../config/supabase');

const getStoreCategories = async (req, res) => {
  try {
    const { id } = req.params; // storeId
    const { data, error } = await supabase
      .from('store_categories')
      .select('*')
      .eq('store_id', id)
      .order('created_at', { ascending: true });

    if (error) {
      return res.status(500).json({ error: 'Error fetching store categories' });
    }
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

const createStoreCategory = async (req, res) => {
  try {
    const { id } = req.params; // storeId
    const { name, image_url } = req.body;

    const { data, error } = await supabase
      .from('store_categories')
      .insert([{ store_id: id, name, image_url }])
      .select();

    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error creating category' });
  }
};

const updateStoreCategory = async (req, res) => {
  try {
    const { id, categoryId } = req.params;
    const { name, image_url } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (image_url !== undefined) updates.image_url = image_url;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const { data, error } = await supabase
      .from('store_categories')
      .update(updates)
      .eq('id', categoryId)
      .eq('store_id', id)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) return res.status(404).json({ error: 'Category not found' });
    
    res.json(data[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error updating category' });
  }
};

const deleteStoreCategory = async (req, res) => {
  try {
    const { id, categoryId } = req.params;
    
    const { error } = await supabase
      .from('store_categories')
      .delete()
      .eq('id', categoryId)
      .eq('store_id', id);

    if (error) throw error;
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting category' });
  }
};

module.exports = {
  getStoreCategories,
  createStoreCategory,
  updateStoreCategory,
  deleteStoreCategory
};
