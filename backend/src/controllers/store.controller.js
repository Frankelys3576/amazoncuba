const supabase = require('../config/supabase');

const generateSlug = (text) => {
  if (!text) return '';
  return text.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const formatStore = (store) => {
  if (!store) return store;
  const info = store.zelle_info || {};
  return {
    ...store,
    province: store.province || info.province || '',
    municipality: store.municipality || info.municipality || '',
    address: store.address || info.address || '',
    lat: store.lat !== undefined && store.lat !== null ? store.lat : (info.lat !== undefined ? info.lat : null),
    lng: store.lng !== undefined && store.lng !== null ? store.lng : (info.lng !== undefined ? info.lng : null),
    price_per_night: store.price_per_night || info.price_per_night || null,
    gallery: info.gallery || []
  };
};

// Obtener todas las tiendas
const getStores = async (req, res) => {
  try {
    let query = supabase.from('stores').select('*');
    
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
    
    const { data, error } = await query.single();

    if (error) {
      console.error('Supabase error fetching store:', error.message);
      return res.status(500).json({ error: 'Error fetching store from database' });
    }
    
    if (!data) return res.status(404).json({ error: 'Tienda no encontrada' });
    
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
      store: formatStore(store),
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
    
    const { data, error } = await supabase
      .from('stores')
      .update({ accepts_zelle, zelle_info })
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
