const supabase = require('../config/supabase');
const { resolveOrdersCaller } = require('../middleware/auth.middleware');

const generateSlug = (text) => {
  if (!text) return '';
  return text.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

// Antes hac\u00eda `...store`, as\u00ed que la respuesta p\u00fablica inclu\u00eda todas las
// columnas: phone, el blob zelle_info, y tras la migraci\u00f3n user_id y las
// columnas legacy_*. Ahora se enumera lo que el frontal usa.
const formatStore = (store) => {
  if (!store) return store;
  const info = store.zelle_info || {};
  const hasZellePayee = info.name != null || info.email_phone != null || info.description != null;
  return {
    id: store.id,
    name: store.name,
    description: store.description,
    logo_url: store.logo_url,
    banner_url: store.banner_url,
    status: store.status,
    created_at: store.created_at,
    store_type: store.store_type,
    slogan: store.slogan,
    phone: store.phone,
    is_open: store.is_open,
    has_delivery: store.has_delivery,
    slug: store.slug,
    opening_time: store.opening_time,
    closing_time: store.closing_time,
    accepts_zelle: store.accepts_zelle,
    store_number: store.store_number,
    province: store.province || info.province || '',
    municipality: store.municipality || info.municipality || '',
    address: store.address || info.address || '',
    lat: store.lat !== undefined && store.lat !== null ? store.lat : (info.lat !== undefined ? info.lat : null),
    lng: store.lng !== undefined && store.lng !== null ? store.lng : (info.lng !== undefined ? info.lng : null),
    price_per_night: store.price_per_night || info.price_per_night || null,
    gallery: info.gallery || [],
    // El blob crudo sigue fuera (lleva user_id heredado, legacy_* y las claves
    // de ubicación ya derivadas arriba), pero el BENEFICIARIO de Zelle sí
    // vuelve: frontend/src/pages/Checkout.jsx lee store.zelle_info y pinta
    // "Titular" y "Zelle (Correo/Tel)". Sin estas tres claves el bloque de
    // instrucciones de pago no se renderiza nunca, mientras accepts_zelle
    // sigue en true y la caja exige un comprobante de un pago que no explica
    // cómo hacer. Son datos que la tienda ya muestra a cualquier cliente
    // anónimo, así que no son una fuga. Si no hay beneficiario configurado
    // (ninguna de las tres claves), se devuelve null en vez de un objeto
    // con los tres campos en null: un objeto siempre-verdadero hacía que
    // Checkout.jsx renderizara el bloque de pago vacío igualmente.
    zelle_info: hasZellePayee
      ? {
          name: info.name ?? null,
          email_phone: info.email_phone ?? null,
          description: info.description ?? null
        }
      : null
  };
};

// Obtener todas las tiendas
const getStores = async (req, res) => {
  try {
    // Un administrador ve todas las tiendas; cualquier otro llamante s\u00f3lo las
    // aprobadas. AdminStores.jsx usa ESTE mismo endpoint para aprobar tiendas
    // pendientes, as\u00ed que el filtro sin la excepci\u00f3n romper\u00eda la aprobaci\u00f3n.
    // Con ?as=admin, requireAdminWhenRequested ya validó la credencial y dejó
    // req.admin puesto: no hace falta volver a preguntarle a Supabase.
    const isAdmin = req.admin
      ? true
      : (await resolveOrdersCaller(req)).kind === 'admin';

    let query = supabase.from('stores').select('*');
    if (!isAdmin) {
      query = query.eq('status', 'approved');
    }

    // Si se pasa un type por query string, filtramos (ej. type=business o type=hostal)
    if (req.query.type) {
      query = query.eq('store_type', req.query.type);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Supabase error fetching stores:', error.message);
      return res.status(500).json({ error: 'Error fetching stores from database' });
    }
    
    let formattedStores = (data || []).map(formatStore);

    if (req.query.province) {
      const provQuery = req.query.province.toLowerCase();
      formattedStores = formattedStores.filter(s => s.province && s.province.toLowerCase() === provQuery);
    }
    if (req.query.municipality) {
      const munQuery = req.query.municipality.toLowerCase();
      formattedStores = formattedStores.filter(s => s.municipality && s.municipality.toLowerCase() === munQuery);
    }
    if (req.query.q) {
      const q = req.query.q.toLowerCase();
      formattedStores = formattedStores.filter(s => 
        (s.name && s.name.toLowerCase().includes(q)) || 
        (s.description && s.description.toLowerCase().includes(q)) ||
        (s.address && s.address.toLowerCase().includes(q))
      );
    }

    res.json(formattedStores);
  } catch (error) {
    console.error('Error fetching stores:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Obtener una tienda por ID
const getStoreById = async (req, res) => {
  try {
    const { id } = req.params;

    // uuid -> primary key, anything else -> slug
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    let query = supabase.from('stores').select('*');
    if (isUuid) {
      query = query.eq('id', id);
    } else {
      query = query.eq('slug', id);
    }
    
    // maybeSingle, no single: con .single() PostgREST devuelve un ERROR
    // cuando no hay filas, así que el `if (error) return 500` de abajo se
    // disparaba antes que el `if (!data) return 404`, y un id/slug que no
    // existe respondía 500 mientras uno pendiente respondía 404. Eso rompe
    // justo la propiedad por la que aquí se eligió 404 en vez de 403: una
    // tienda oculta tiene que ser indistinguible de una que no existe.
    // (backend-nest ya respondía 404 en los dos casos.)
    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error('Supabase error fetching store:', error.message);
      return res.status(500).json({ error: 'Error fetching store from database' });
    }
    
    if (!data) return res.status(404).json({ error: 'Tienda no encontrada' });

    // Una tienda no aprobada (pending/rejected) sólo la puede ver un
    // administrador o el vendedor dueño de ESA tienda -- por ejemplo, justo
    // después de registrarse, mientras espera aprobación. Cualquier otro
    // llamante recibe el mismo 404 que "no existe": un 403 confirmaría que
    // la tienda existe, que es justo lo que no queremos revelar. El slug es
    // legible por humanos, así que además de "conocible" es "adivinable".
    if (data.status !== 'approved') {
      const caller = await resolveOrdersCaller(req);
      const isAdmin = caller.kind === 'admin';
      const isOwner = caller.kind === 'seller' && String(caller.store.id) === String(data.id);
      if (!isAdmin && !isOwner) {
        return res.status(404).json({ error: 'Tienda no encontrada' });
      }
    }

    res.json(formatStore(data));
  } catch (error) {
    console.error('Error fetching store:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Actualizar el estado de una tienda
const updateStoreStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const { data, error } = await supabase
      .from('stores')
      .update({ status })
      .eq('id', id)
      .select();

    if (error) {
      console.error('Supabase error updating store:', error.message);
      return res.status(500).json({ error: 'Error updating store in database' });
    }
    
    if (!data || data.length === 0) return res.status(404).json({ error: 'Tienda no encontrada' });
    
    res.json(formatStore(data[0]));
  } catch (error) {
    console.error('Error updating store:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Actualizar el perfil de la tienda (para el panel del vendedor)
const updateStoreProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, slogan, phone, logo_url, banner_url, is_open, has_delivery, opening_time, closing_time, store_type, province, municipality, address, lat, lng, price_per_night, gallery } = req.body;
    
    // First fetch existing store data to preserve zelle_info
    const { data: existingStore } = await supabase.from('stores').select('*').eq('id', id).single();
    
    const updates = {};
    if (name !== undefined) {
      updates.name = name;
      updates.slug = generateSlug(name);
    }
    if (description !== undefined) updates.description = description;
    if (slogan !== undefined) updates.slogan = slogan;
    if (phone !== undefined) updates.phone = phone;
    if (logo_url !== undefined) updates.logo_url = logo_url;
    if (banner_url !== undefined) updates.banner_url = banner_url;
    if (is_open !== undefined) updates.is_open = is_open;
    if (has_delivery !== undefined) updates.has_delivery = has_delivery;
    if (opening_time !== undefined) updates.opening_time = opening_time;
    if (closing_time !== undefined) updates.closing_time = closing_time;
    if (store_type !== undefined) updates.store_type = store_type;
    
    if (province !== undefined || municipality !== undefined || address !== undefined || lat !== undefined || lng !== undefined || price_per_night !== undefined || gallery !== undefined) {
      const currentZelleInfo = existingStore?.zelle_info || {};
      updates.zelle_info = {
        ...currentZelleInfo,
        ...(province !== undefined && { province }),
        ...(municipality !== undefined && { municipality }),
        ...(address !== undefined && { address }),
        ...(lat !== undefined && { lat }),
        ...(lng !== undefined && { lng }),
        ...(price_per_night !== undefined && { price_per_night }),
        ...(gallery !== undefined && { gallery })
      };
    }
    
    // Si no hay nada que actualizar
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    const { data, error } = await supabase
      .from('stores')
      .update(updates)
      .eq('id', id)
      .select();

    if (error) {
      console.error('Supabase error updating store profile:', error.message);
      return res.status(500).json({ error: 'Error updating store in database' });
    }
    
    if (!data || data.length === 0) return res.status(404).json({ error: 'Tienda no encontrada' });
    
    res.json(formatStore(data[0]));
  } catch (error) {
    console.error('Error updating store profile:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Obtener estadísticas de la tienda
const getStoreStats = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Obtener inicio del día actual
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTodayStr = startOfToday.toISOString();

    // Obtener inicio del mes actual
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const startOfMonthStr = startOfMonth.toISOString();

    const [todayRes, monthRes, totalRes] = await Promise.all([
      supabase.from('product_views').select('id, products!inner(store_id)', { count: 'exact', head: true }).eq('products.store_id', id).gte('created_at', startOfTodayStr),
      supabase.from('product_views').select('id, products!inner(store_id)', { count: 'exact', head: true }).eq('products.store_id', id).gte('created_at', startOfMonthStr),
      supabase.from('product_views').select('id, products!inner(store_id)', { count: 'exact', head: true }).eq('products.store_id', id)
    ]);

    if (todayRes.error || monthRes.error || totalRes.error) {
      console.error('Supabase error fetching stats');
      return res.status(500).json({ error: 'Error fetching stats' });
    }
    
    res.json({ 
      viewsToday: todayRes.count || 0,
      viewsThisMonth: monthRes.count || 0,
      viewsTotal: totalRes.count || 0
    });
  } catch (error) {
    console.error('Error fetching store stats:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Obtener detalles completos de la tienda para el Admin
const getAdminStoreDetails = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Obtener detalles de la tienda
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('*')
      .eq('id', id)
      .single();

    if (storeError) {
      console.error('Error fetching store for admin:', storeError.message);
      return res.status(500).json({ error: 'Error al obtener la tienda' });
    }

    if (!store) {
      return res.status(404).json({ error: 'Tienda no encontrada' });
    }

    // 2. Contar productos
    const { count: productsCount, error: prodError } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', id);

    if (prodError) console.error('Error counting products:', prodError.message);

    // 3. Contar ventas totales (sumando cantidades de order_items de productos de esta tienda)
    const { data: orderItems, error: orderError } = await supabase
      .from('order_items')
      .select('quantity, products!inner(store_id)')
      .eq('products.store_id', id);

    let totalSales = 0;
    if (orderItems && !orderError) {
      totalSales = orderItems.reduce((acc, item) => acc + item.quantity, 0);
    } else if (orderError) {
      console.error('Error calculating sales:', orderError.message);
    }

    res.json({
      // El blob zelle_info COMPLETO, no el subconjunto público de
      // formatStore. Esta ruta va detrás de authenticateAdmin, y el panel
      // (admin-frontend/src/AdminStores.jsx:62-66) rellena su formulario de
      // Zelle desde details.store.zelle_info. Con el subconjunto bastaba con
      // que el administrador abriera el modal y pulsara "guardar" para que
      // handleSaveZelle mandara { name:'', email_phone:'', description:'' }
      // y updateZelleInfo lo escribiera ENTERO encima: los datos de cobro
      // reales del vendedor, borrados.
      store: { ...formatStore(store), zelle_info: store.zelle_info },
      activeProductsCount: productsCount || 0,
      totalSalesCount: totalSales || 0
    });
  } catch (error) {
    console.error('Error fetching admin store details:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateZelleInfo = async (req, res) => {
  try {
    const { id } = req.params;
    const { accepts_zelle, zelle_info } = req.body;

    const updates = {};
    // Sólo se toca accepts_zelle si el llamante lo mandó, para que un
    // payload que sólo trae zelle_info no anule la columna.
    if (accepts_zelle !== undefined) updates.accepts_zelle = accepts_zelle;

    // zelle_info es UN blob JSON compartido por dos cosas sin relación: el
    // beneficiario de Zelle (name/email_phone/description) y la ubicación de
    // la tienda (province/municipality/address/lat/lng/price_per_night/
    // gallery). El formulario de Zelle del admin (admin-frontend/src/
    // AdminStores.jsx) sólo manda las tres claves del beneficiario, así que
    // escribir zelle_info tal cual encima de la columna -- como hacía esto
    // antes -- borraba en silencio el pin del mapa, la dirección y las fotos
    // de un hostal en cada guardado de Zelle desde el admin. Mismo patrón
    // que updateStoreProfile ya usa para este blob: se lee el actual y se
    // mezcla en el nivel superior, así `name: ''` sigue borrando el
    // beneficiario (el formulario lo hace a propósito) mientras un `lat`
    // ausente queda intacto. Si zelle_info no viene en absoluto, el blob no
    // se toca.
    if (zelle_info !== undefined) {
      // maybeSingle, no single: con .single() un error transitorio de lectura
      // (una interrupción momentánea de la base de datos, no "no existe la
      // fila") también deja `data` en falsy, y el código seguía adelante
      // fusionando contra un currentZelleInfo === {} -- exactamente la
      // pérdida de datos que este commit existe para evitar, sólo que
      // disparada por un fallo transitorio en vez de determinista. Con
      // maybeSingle un error real de lectura sigue siendo `error` (500, no
      // se escribe nada) y "no existe la fila" es `data: null, error: null`
      // (404), así que ambos casos quedan distinguidos explícitamente en vez
      // de colapsar en el mismo `?? {}`. Mismo patrón que getStoreById ya usa
      // en este archivo.
      const { data: existingStore, error: existingError } = await supabase
        .from('stores')
        .select('zelle_info')
        .eq('id', id)
        .maybeSingle();

      if (existingError) {
        console.error('Supabase error reading zelle info:', existingError.message);
        return res.status(500).json({ error: 'Error updating zelle info in database' });
      }
      if (!existingStore) return res.status(404).json({ error: 'Tienda no encontrada' });

      const currentZelleInfo = existingStore.zelle_info || {};
      updates.zelle_info = { ...currentZelleInfo, ...zelle_info };
    }

    const { data, error } = await supabase
      .from('stores')
      .update(updates)
      .eq('id', id)
      .select();

    if (error) {
      console.error('Supabase error updating zelle info:', error.message);
      return res.status(500).json({ error: 'Error updating zelle info in database' });
    }
    
    if (!data || data.length === 0) return res.status(404).json({ error: 'Tienda no encontrada' });
    
    res.json(data[0]);
  } catch (error) {
    console.error('Error updating zelle info:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Actualizar credenciales del vendedor (teléfono como email y contraseña)
const updateStoreCredentials = async (req, res) => {
  try {
    const { id } = req.params;
    const { phone, password } = req.body;
    // req.user y req.store ya vienen validados por el middleware authenticateSeller/requireStoreOwnership
    const { user, store } = req;

    const updates = {};
    let cleanPhone = null;
    
    if (phone) {
      cleanPhone = phone.replace(/[^0-9]/g, '');
      updates.email = `${cleanPhone}@cubaamazon.com`;
    }
    
    if (password) {
      updates.password = password;
    }
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No se enviaron datos para actualizar' });
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, updates);
    
    if (updateError) {
      console.error('Error updating auth user:', updateError);
      return res.status(500).json({ error: 'Error al actualizar las credenciales en Auth' });
    }
    
    if (cleanPhone) {
      const { error: storeUpdateError } = await supabase.from('stores').update({ phone: cleanPhone }).eq('id', id);
      if (storeUpdateError) {
         console.error('Error updating store phone:', storeUpdateError);
      }
    }
    
    res.json({ message: 'Credenciales actualizadas exitosamente', phone: cleanPhone || store.phone });
  } catch (err) {
    console.error('Error in updateStoreCredentials:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = {
  getStores,
  getStoreById,
  updateStoreStatus,
  updateZelleInfo,
  updateStoreProfile,
  getStoreStats,
  getAdminStoreDetails,
  updateStoreCredentials
};
