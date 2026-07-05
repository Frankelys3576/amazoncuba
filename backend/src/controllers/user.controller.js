const supabase = require('../config/supabase');

const getUsers = async (req, res) => {
  try {
    const { data, error } = await supabase.auth.admin.listUsers();
    
    if (error) throw error;

    const users = data.users.map(user => ({
      id: user.id,
      email: user.email,
      full_name: user.user_metadata?.full_name || 'Sin nombre',
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
      email_confirmed: user.email_confirmed_at ? true : false
    }));

    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error.message);
    res.status(500).json({ error: 'Error al obtener usuarios. Asegúrate de usar SERVICE_ROLE_KEY.' });
  }
};

module.exports = {
  getUsers
};
