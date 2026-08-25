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

// Resuelve QUIÉN es el llamante sin tocar `res`.
//
// authenticateSeller y authenticateAdmin son middlewares: en cuanto algo no
// cuadra, RESPONDEN. Eso impide componerlos ("vale el vendedor dueño de la
// tienda O un administrador"), porque el primero en fallar cierra la
// respuesta y el segundo ya no puede decidir nada. Este helper sólo mira la
// credencial y describe al llamante; quien lo llama decide y envía la única
// respuesta final.
//
// Devuelve una de estas formas:
//   { kind: 'anonymous', error }        sin credencial válida (401)
//   { kind: 'admin',  user }            app_metadata.role === 'admin'
//   { kind: 'seller', user, store }     autenticado y con tienda propia
//   { kind: 'user',   user }            autenticado, ni admin ni con tienda
//
// El motivo del rechazo viaja en `error` en vez de devolver null a secas para
// no perder la distinción entre "falta la cabecera" y "el token no vale":
// son dos 401 con mensajes distintos que el panel ya mostraba.
const resolveOrdersCaller = async (req) => {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) {
    return { kind: 'anonymous', error: 'Token no proporcionado' };
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return { kind: 'anonymous', error: 'Token inválido o expirado' };
  }

  // El rol se mira antes que la tienda: un administrador que además tuviera
  // tienda sigue siendo administrador aquí.
  if (user.app_metadata && user.app_metadata.role === 'admin') {
    return { kind: 'admin', user };
  }

  const { data: store } = await supabase
    .from('stores')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (store) {
    return { kind: 'seller', user, store };
  }

  return { kind: 'user', user };
};

// Autorización de GET /api/orders. La ruta tiene tres llamantes legítimos y
// cada uno merece una comprobación distinta:
//
//   ?ids=...     el cliente consultando "mis pedidos". Conocer los ids ES la
//                credencial. OJO: sólo es seguro con ids UUID v7; mientras los
//                ids sean enteros consecutivos se pueden enumerar.
//   ?storeId=... el panel del vendedor Y el panel de administración. Exige
//                sesión: o la del vendedor dueño de ESA tienda, o la de un
//                administrador (que puede consultar cualquiera). Un vendedor
//                sigue sin poder leer los pedidos de otra tienda.
//   sin filtro   devuelve la tabla completa con nombre, correo, teléfono y
//                dirección de cada cliente. Sólo administración.
//
// La rama de ?storeId= exigía sesión de VENDEDOR y nada más, así que el panel
// de administración —que manda su propio token— recibía un 403 al pulsar "ver
// pedidos" de una tienda: el administrador no tiene fila en `stores`.
const authorizeOrdersQuery = async (req, res, next) => {
  const { storeId, ids } = req.query;

  if (ids) return next();

  if (storeId) {
    try {
      const caller = await resolveOrdersCaller(req);

      if (caller.kind === 'anonymous') {
        return res.status(401).json({ error: caller.error });
      }

      if (caller.kind === 'admin') {
        req.admin = caller.user;
        return next();
      }

      if (caller.kind !== 'seller') {
        return res.status(403).json({ error: 'No se encontró una tienda asociada a este usuario' });
      }

      if (String(caller.store.id) !== String(storeId)) {
        return res.status(403).json({ error: 'No tienes permiso sobre esta tienda' });
      }

      req.user = caller.user;
      req.store = caller.store;
      return next();
    } catch (error) {
      console.error('Error in authorizeOrdersQuery:', error.message);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  return authenticateAdmin(req, res, next);
};

// Estados que un vendedor puede fijar. Un cliente sólo puede marcar
// 'delivered' ("marcar como recibido"), y un administrador cualquiera de la
// lista.
const SELLER_ORDER_STATUSES = ['shipped', 'delivered'];

// ¿Contiene el pedido algún producto de esta tienda?
const sellerOwnsOrder = async (storeId, orderId) => {
  const { data, error } = await supabase
    .from('order_items')
    .select('order_id, products!inner(store_id)')
    .eq('order_id', orderId)
    .eq('products.store_id', storeId)
    .limit(1);

  if (error) throw error;
  return Boolean(data && data.length > 0);
};

// Autorización de PUT /api/orders/:id. Tres llamantes, tres reglas:
//
//   cliente        sin credencial. Conocer el id del pedido ES la credencial,
//                  igual que en ?ids=. Sólo puede marcar 'delivered'.
//   vendedor       sesión válida Y el pedido contiene un producto suyo.
//                  Sólo estados de gestión.
//   administrador  cualquier estado de la lista.
//
// Antes de esto la ruta no comprobaba NADA: cualquiera podía fijar cualquier
// estado en cualquier pedido recorriendo los ids.
const authorizeOrderUpdate = async (req, res, next) => {
  try {
    const { status } = req.body || {};

    if (!req.headers.authorization) {
      if (status !== 'delivered') {
        return res.status(403).json({ error: 'No tienes permiso para cambiar este pedido' });
      }
      return next();
    }

    const caller = await resolveOrdersCaller(req);

    if (caller.kind === 'anonymous') {
      return res.status(401).json({ error: caller.error });
    }

    if (caller.kind === 'admin') {
      req.admin = caller.user;
      return next();
    }

    if (caller.kind !== 'seller') {
      return res.status(403).json({ error: 'No se encontró una tienda asociada a este usuario' });
    }

    if (!SELLER_ORDER_STATUSES.includes(status)) {
      return res.status(403).json({ error: 'No tienes permiso para cambiar este pedido' });
    }

    if (!(await sellerOwnsOrder(caller.store.id, req.params.id))) {
      return res.status(403).json({ error: 'No tienes permiso sobre este pedido' });
    }

    req.user = caller.user;
    req.store = caller.store;
    return next();
  } catch (error) {
    console.error('Error in authorizeOrderUpdate:', error.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = {
  extractBearerToken,
  resolveOrdersCaller,
  authenticateSeller,
  requireStoreOwnership,
  authenticateAdmin,
  authorizeOrdersQuery,
  authorizeOrderUpdate
};
