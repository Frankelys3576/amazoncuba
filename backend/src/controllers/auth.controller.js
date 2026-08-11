const supabase = require('../config/supabase');

const generateSlug = (text) => {
  if (!text) return '';
  return text.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const register = async (req, res) => {
  try {
    const { 
      email, password, full_name, store_name, store_type,
      province, municipality, address, lat, lng, price_per_night, description
    } = req.body;

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
      // Extraer el teléfono del email si es posible y normalizarlo (quitar '+' y espacios)
      let phoneMatch = email.split('@')[0];
      if (phoneMatch) {
        phoneMatch = phoneMatch.replace(/\+/g, '').replace(/\s/g, '');
      }
      
      // Generate a 6-digit random number
      const store_number = Math.floor(100000 + Math.random() * 900000).toString();
      const slug = generateSlug(store_name);

      const zelle_info = {
        province: province || null,
        municipality: municipality || null,
        address: address || null,
        lat: lat ? parseFloat(lat) : null,
        lng: lng ? parseFloat(lng) : null,
        price_per_night: price_per_night ? parseFloat(price_per_night) : null
      };

      const { error: storeError } = await supabase.from('stores').insert([
        { 
          name: store_name, 
          slug: slug,
          description: description || (store_type === 'hostal' ? `Hostal de ${full_name}` : `Nueva tienda de ${full_name}`),
          status: isAutoApprove ? 'approved' : 'pending',
          store_type: store_type || 'business',
          phone: phoneMatch,
          store_number: store_number,
          zelle_info
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

    // Buscar la tienda asociada a este usuario (por teléfono, extraído del email, normalizado)
    let phoneMatch = email.split('@')[0];
    if (phoneMatch) {
      phoneMatch = phoneMatch.replace(/\+/g, '').replace(/\s/g, '');
    }
    
    let store = null;
    try {
      const { data: storeData } = await supabase
        .from('stores')
        .select('*')
        .ilike('phone', `%${phoneMatch}%`)
        .limit(1)
        .single();
      store = storeData;
    } catch (err) {
      console.error('No store found for user', phoneMatch);
    }

    // Devolvemos el token de sesión y los datos del usuario al frontend
    res.json({
      message: 'Login exitoso',
      session: data.session,
      user: data.user,
      store: store
    });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(401).json({ error: 'Credenciales inválidas' });
  }
};

const deleteAccount = async (req, res) => {
  try {
    const { storeId } = req.body;

    if (!storeId) {
      return res.status(400).json({ error: 'Store ID is required' });
    }

    // 1. Obtener todos los productos de la tienda
    const { data: products } = await supabase
      .from('products')
      .select('id')
      .eq('store_id', storeId);

    const productIds = products ? products.map(p => p.id) : [];

    // 2. Eliminar order_items de esos productos (para no romper la BD)
    if (productIds.length > 0) {
      await supabase
        .from('order_items')
        .delete()
        .in('product_id', productIds);
        
      // 3. Eliminar los productos
      await supabase
        .from('products')
        .delete()
        .in('id', productIds);
    }

    // 4. Eliminar la tienda
    const { error: storeError } = await supabase
      .from('stores')
      .delete()
      .eq('id', storeId);

    if (storeError) throw storeError;

    // Nota: El usuario de Auth (auth.users) quedará huérfano, 
    // pero para este MVP borrar la tienda y sus productos es suficiente 
    // para considerarlo "eliminado".

    res.json({ message: 'Cuenta eliminada exitosamente' });
  } catch (error) {
    console.error('Delete account error:', error.message);
    res.status(500).json({ error: 'Error al eliminar la cuenta' });
  }
};

module.exports = {
  register,
  login,
  deleteAccount
};
