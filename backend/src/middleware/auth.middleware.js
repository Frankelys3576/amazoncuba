const supabase = require('../config/supabase');

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

    const { data: store } = await supabase
      .from('stores')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

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

// Autenticación de administrador.
//
// El rol vive en app_metadata, que sólo se puede escribir con la
// SERVICE_ROLE_KEY. En user_metadata NO serviría: cualquier usuario
// autenticado puede modificar el suyo con updateUser, así que un vendedor
// podría concederse permisos de administrador él mismo.
//
// Sustituye a requireAdmin, que comprobaba una clave compartida: cerraba el
// agujero pero no identificaba a nadie.
const authenticateAdmin = async (req, res, next) => {
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

// Autorización de GET /api/orders. La ruta tiene tres llamantes legítimos y
// cada uno merece una comprobación distinta:
//
//   ?ids=...     el cliente consultando "mis pedidos". Conocer los ids ES la
//                credencial. OJO: sólo es seguro con ids UUID v7; mientras los
//                ids sean enteros consecutivos se pueden enumerar.
//   ?storeId=... el panel del vendedor. Exige sesión de vendedor Y que la
//                tienda consultada sea la suya.
//   sin filtro   devuelve la tabla completa con nombre, correo, teléfono y
//                dirección de cada cliente. Sólo administración.
const authorizeOrdersQuery = (req, res, next) => {
  const { storeId, ids } = req.query;

  if (ids) return next();

  if (storeId) {
    return authenticateSeller(req, res, () => {
      if (String(req.store.id) !== String(storeId)) {
        return res.status(403).json({ error: 'No tienes permiso sobre esta tienda' });
      }
      next();
    });
  }

  return authenticateAdmin(req, res, next);
};

module.exports = {
  authenticateSeller,
  requireStoreOwnership,
  authenticateAdmin,
  authorizeOrdersQuery
};
