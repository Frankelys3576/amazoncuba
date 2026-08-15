const supabase = require('../config/supabase');

// Misma heurística que auth.controller.js login(): el teléfono se extrae
// del local-part del email y se usa para encontrar la tienda del vendedor
// (no existe una columna user_id que vincule stores <-> auth.users).
const extractPhoneFromEmail = (email) => {
  let phone = email.split('@')[0];
  return phone.replace(/\+/g, '').replace(/\s/g, '');
};

const authenticateSeller = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }

    const phone = extractPhoneFromEmail(user.email);
    const { data: store } = await supabase
      .from('stores')
      .select('*')
      .ilike('phone', `%${phone}%`)
      .limit(1)
      .single();

    if (!store) {
      return res.status(403).json({ error: 'No se encontró una tienda asociada a este usuario' });
    }

    req.user = user;
    req.store = store;
    next();
  } catch (error) {
    console.error('Error in authenticateSeller:', error.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const requireStoreOwnership = (req, res, next) => {
  if (String(req.store.id) !== String(req.params.id)) {
    return res.status(403).json({ error: 'No tienes permiso sobre esta tienda' });
  }
  next();
};

module.exports = {
  authenticateSeller,
  requireStoreOwnership
};
