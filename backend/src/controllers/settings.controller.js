const supabase = require('../config/supabase');

const getSettings = async (req, res) => {
  try {
    const { data, error } = await supabase.from('platform_settings').select('*');
    if (error) throw error;
    
    // Convert array to key-value object
    const settings = {};
    data.forEach(item => {
      settings[item.key] = item.value;
    });
    
    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateSetting = async (req, res) => {
  try {
    const { key, value } = req.body;
    
    const { data, error } = await supabase
      .from('platform_settings')
      .update({ value, updated_at: new Date().toISOString() })
      .eq('key', key)
      .select();

    if (error) throw error;
    
    res.json({ message: 'Setting updated successfully', data });
  } catch (error) {
    console.error('Error updating setting:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getSettings,
  updateSetting
};
