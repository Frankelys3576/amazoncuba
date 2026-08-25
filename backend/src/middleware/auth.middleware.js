const supabase = require('../config/supabase');

// Extrae el token de una cabecera Authorization, o devuelve null si la
// cabecera falta o está malformada.
//
// Defensa en profundidad. El código anterior hacía authHeader.split(' ')[1],
// que para una cabecera "Bearer" a secas da undefined, y lo pasaba tal cual a
// supabase.auth.getUser(). getUser(undefined) NO falla: recae en la sesión
// que el cliente compartido tenga guardada (ver config/supabase.js). Aunque
// ese cliente ya no guarda ninguna, no queremos que la autorización dependa
// de un detalle interno de una librería: exigimos aquí un esquema Bearer con
// un token no vacío antes de preguntarle nada a Supabase.
const extractBearerToken = (authHeader) => {
  if (typeof authHeader !== 'string') return null;

  const parts = authHeader.trim().split(/\s+/);
  if (parts.length !== 2) return null;

  const [scheme, token] = parts;
  if (!/^Bearer$/i.test(scheme)) return null;
  if (!token) return null;

  return token;
};

// Autenticación de administrador.
//
// El rol vive en app_metadata, que sólo se puede escribir con la
// SERVICE_ROLE_KEY. En user_metadata NO serviría: cualquier usuario
// autenticado puede modificar el suyo con updateUser, así que un vendedor
// podría concederse permisos de administrador él mismo.
const authenticateAdmin = async (req, res, next) => {
  try {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }

    if (!user.app_metadata || user.app_metadata.role !== 'admin') {
      return res.status(403).json({ error: 'No tienes permisos de administrador' });
    }

    req.admin = user;
    next();
  } catch (error) {
    console.error('Error in authenticateAdmin:', error.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Misma heurística que auth.controller.js login(): el teléfono se extrae
// del local-part del email y se usa para encontrar la tienda del vendedor
// (no existe una columna user_id que vincule stores <-> auth.users).
const extractPhoneFromEmail = (email) => {
  let phone = email.split('@')[0];
  return phone.replace(/\+/g, '').replace(/\s/g, '');
};

const authenticateSeller = async (req, res, next) => {
  try {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }

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
  extractBearerToken,
  authenticateSeller,
  requireStoreOwnership,
  authenticateAdmin
};
