const supabase = require('../config/supabase');

const register = async (req, res) => {
  try {
    const { email, password, full_name, store_name, store_type } = req.body;

    // Usamos el API de Admin para crear al usuario saltándonos los límites de tasa 
    // y autoconfirmando el email (útil para números de teléfono falsos)
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
      }
    });

    if (error) throw error;

    // Verificar si está habilitada la aprobación automática
    let isAutoApprove = false;
    try {
      const { data: settingsData } = await supabase
        .from('platform_settings')
        .select('*')
        .eq('key', 'auto_approve_sellers')
        .single();
      
      if (settingsData && settingsData.value === 'true') {
        isAutoApprove = true;
      }
    } catch (err) {
      console.error('Error reading auto_approve_sellers setting:', err);
    }

    // Crear la tienda pendiente en la base de datos
    if (store_name) {
      const { error: storeError } = await supabase.from('stores').insert([
        { 
          name: store_name, 
          description: `Nueva tienda de ${full_name}`,
          status: isAutoApprove ? 'approved' : 'pending',
          store_type: store_type || 'business'
        }
      ]);
      
      if (storeError) {
        console.error('Error creating store:', storeError);
        // Podríamos manejar este error o simplemente dejarlo pasar
      }
    }

    res.status(201).json({ 
      message: 'Usuario y tienda registrados exitosamente', 
      user: data.user,
      autoApproved: isAutoApprove 
    });
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
