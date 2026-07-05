const supabase = require('../config/supabase');

const register = async (req, res) => {
  try {
    const { email, password, full_name } = req.body;

    // Registramos al usuario en Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name,
        }
      }
    });

    if (error) throw error;

    // Opcional: Podríamos crear un registro en la tabla 'users' pública si es necesario
    // Pero Supabase lo maneja internamente. Por ahora devolvemos la info.
    res.status(201).json({ message: 'Usuario registrado exitosamente', user: data.user });
  } catch (error) {
    console.error('Registration error:', error.message);
    res.status(400).json({ error: error.message || 'Error al registrar el usuario' });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Iniciamos sesión usando Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    // Devolvemos el token de sesión y los datos del usuario al frontend
    res.json({
      message: 'Login exitoso',
      session: data.session,
      user: data.user
    });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(401).json({ error: 'Credenciales inválidas' });
  }
};

module.exports = {
  register,
  login
};
