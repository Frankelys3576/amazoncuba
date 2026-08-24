const supabase = require('../config/supabase');

// Sólo hay una cuenta de administrador. Si se borra o se le cambia la
// contraseña desde el propio panel, no queda ninguna otra cuenta capaz de
// devolver el acceso: la pérdida es definitiva. Por eso las rutas de usuarios
// se niegan a tocar una cuenta con rol de administrador.
const rejectIfAdminAccount = async (id, res) => {
  const { data, error } = await supabase.auth.admin.getUserById(id);

  if (error || !data || !data.user) {
    res.status(404).json({ error: 'Usuario no encontrado' });
    return true;
  }

  if (data.user.app_metadata && data.user.app_metadata.role === 'admin') {
    res.status(403).json({ error: 'No se puede modificar ni eliminar una cuenta de administrador' });
    return true;
  }

  return false;
};

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

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (await rejectIfAdminAccount(id, res)) return;
    const { error } = await supabase.auth.admin.deleteUser(id);
    
    if (error) throw error;
    
    res.json({ message: 'Usuario eliminado correctamente' });
  } catch (error) {
    console.error('Error deleting user:', error.message);
    res.status(500).json({ error: 'Error al eliminar usuario.' });
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { email, password } = req.body;
    
    if (!email && !password) {
      return res.status(400).json({ error: 'Debe proporcionar un nuevo correo o contraseña.' });
    }

    if (await rejectIfAdminAccount(id, res)) return;

    const updates = {};
    if (email) updates.email = email;
    if (password) updates.password = password;

    const { data, error } = await supabase.auth.admin.updateUserById(id, updates);
    
    if (error) throw error;
    
    res.json({ message: 'Usuario actualizado correctamente', user: data.user });
  } catch (error) {
    console.error('Error updating user:', error.message);
    res.status(500).json({ error: 'Error al actualizar usuario: ' + error.message });
  }
};

module.exports = {
  getUsers,
  deleteUser,
  updateUser
};
