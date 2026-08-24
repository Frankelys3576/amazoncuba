const crypto = require('crypto');
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
// Hasta ahora la API administrativa no comprobaba NADA: admin-frontend
// guardaba la cadena 'master_token' en localStorage, la leía una sola vez para
// decidir si pintaba el panel, y nunca la enviaba en ninguna petición. Es
// decir, `GET /api/users` devolvía todos los usuarios y
// `PUT /api/users/:id` cambiaba la contraseña de cualquiera de ellos sin
// credencial alguna: dos peticiones para tomar el control de toda la
// plataforma.
//
// Esto es un cierre de emergencia, no el diseño definitivo: una clave
// compartida no identifica a una persona y por tanto no deja rastro de quién
// hizo qué. El diseño real (autenticación por usuario) sustituirá a esta
// función; mientras tanto, cierra el agujero.
//
// Falla cerrado a propósito: si ADMIN_API_KEY no está configurada, se rechaza
// todo. Es preferible un panel que no funciona a una API administrativa
// abierta a Internet.
const requireAdmin = (req, res, next) => {
  const expected = process.env.ADMIN_API_KEY;

  if (!expected) {
    console.error('ADMIN_API_KEY no está configurada: se rechazan las rutas administrativas.');
    return res.status(503).json({ error: 'La administración no está disponible en este momento.' });
  }

  const provided = req.headers['x-admin-key'];
  if (typeof provided !== 'string' || !provided) {
    return res.status(401).json({ error: 'Credencial de administrador no proporcionada' });
  }

  // Comparación en tiempo constante. timingSafeEqual exige la misma longitud,
  // así que se comparan los digests: así la longitud de la clave tampoco se
  // filtra por el tiempo de respuesta.
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  if (!crypto.timingSafeEqual(a, b)) {
    return res.status(403).json({ error: 'Credencial de administrador inválida' });
  }

  next();
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

  return requireAdmin(req, res, next);
};

module.exports = {
  authenticateSeller,
  requireStoreOwnership,
  requireAdmin,
  authorizeOrdersQuery
};
