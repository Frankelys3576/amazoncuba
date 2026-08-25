const getBaseApiUrl = () => {
  if (import.meta.env.PROD) {
    return 'https://backend-lilac-xi-77.vercel.app/api';
  }
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return `http://${window.location.hostname}:5001/api`;
  }
  return 'http://localhost:5001/api';
};

const API_URL = import.meta.env.VITE_API_URL || getBaseApiUrl();

const adminHeaders = (extra = {}) => ({
  'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
  ...extra,
});

// El panel devolvía [] cuando el backend respondía 401/403, así que una sesión
// caducada era indistinguible de una lista vacía. Ahora se limpia la sesión y
// se vuelve al login.
//
// SÓLO con 401. Un 403 significa "estás autenticado pero esto no te toca":
// la sesión es perfectamente válida y borrarla convierte cualquier error de
// permisos en una expulsión al login, una y otra vez. El 403 se deja pasar
// para que lo trate quien haya llamado.
const handleAuthFailure = (response) => {
  if (response.status === 401) {
    localStorage.removeItem('admin_token');
    window.location.href = '/login';
    return true;
  }
  return false;
};

export const loginAdmin = async (email, password) => {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  });

  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, data };
};

export const getProducts = async (params = {}) => {
  try {
    const query = new URLSearchParams();
    if (params.storeId) query.append('storeId', params.storeId);
    if (params.q) query.append('q', params.q);
    if (params.category) query.append('category', params.category);

    const queryString = query.toString();
    const url = queryString ? `${API_URL}/products?${queryString}` : `${API_URL}/products`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('Error al obtener productos');
    return await response.json();
  } catch (error) {
    console.error('API getProducts error:', error);
    return [];
  }
};

export const getProductById = async (id) => {
  try {
    const response = await fetch(`${API_URL}/products/${id}`);
    if (!response.ok) throw new Error('Error al obtener producto');
    return await response.json();
  } catch (error) {
    console.error('API getProductById error:', error);
    return null;
  }
};

export const createOrder = async (orderData) => {
  try {
    const response = await fetch(`${API_URL}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderData)
    });
    if (!response.ok) throw new Error('Error al crear el pedido');
    return await response.json();
  } catch (error) {
    console.error('API createOrder error:', error);
    throw error;
  }
};

export const getStores = async () => {
  try {
    // GET /api/stores ahora sólo devuelve tiendas 'approved' salvo que el
    // llamante sea administrador. AdminStores.jsx usa esta misma función para
    // ver (y aprobar) tiendas pendientes, así que sin el token el panel
    // perdería silenciosamente las tiendas pendientes/rechazadas.
    //
    // ?as=admin: la ruta es pública, así que con un token caducado respondía
    // 200 con el listado recortado y handleAuthFailure (que sólo mira el 401)
    // no se enteraba: el panel mostraba CERO tiendas pendientes y ningún
    // error. Con el parámetro, el backend exige credencial de administrador y
    // devuelve 401, que sí devuelve al login.
    const response = await fetch(`${API_URL}/stores?as=admin`, { headers: adminHeaders() });
    if (handleAuthFailure(response)) return [];
    if (!response.ok) throw new Error('Error al obtener tiendas');
    return await response.json();
  } catch (error) {
    console.error('API getStores error:', error);
    return [];
  }
};

export const getStoreById = async (id) => {
  try {
    const response = await fetch(`${API_URL}/stores/${id}`);
    if (!response.ok) throw new Error('Error al obtener tienda');
    return await response.json();
  } catch (error) {
    console.error('API getStoreById error:', error);
    return null;
  }
};

export const getAdminStoreDetails = async (id) => {
  try {
    const response = await fetch(`${API_URL}/stores/${id}/admin-details`, {
      headers: adminHeaders()
    });
    if (handleAuthFailure(response)) return null;
    if (!response.ok) throw new Error('Error al obtener detalles de tienda');
    return await response.json();
  } catch (error) {
    console.error('API getAdminStoreDetails error:', error);
    return null;
  }
};

export const loginSeller = async (email, password) => {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Credenciales inválidas');
  }
  
  return await response.json();
};

export const registerSeller = async (userData) => {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(userData)
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Error en el registro');
  }
  
  return await response.json();
};

export const updateStoreStatus = async (id, status) => {
  try {
    const response = await fetch(`${API_URL}/stores/${id}/status`, {
      method: 'PUT',
      headers: adminHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ status })
    });
    if (handleAuthFailure(response)) return null;
    if (!response.ok) throw new Error('Error al actualizar estado de la tienda');
    return await response.json();
  } catch (error) {
    console.error('API updateStoreStatus error:', error);
    throw error;
  }
};

export const updateZelleConfig = async (id, zelleData) => {
  try {
    const response = await fetch(`${API_URL}/stores/${id}/zelle`, {
      method: 'PUT',
      headers: adminHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(zelleData)
    });
    if (handleAuthFailure(response)) return null;
    if (!response.ok) throw new Error('Error al actualizar configuración de Zelle');
    return await response.json();
  } catch (error) {
    console.error('API updateZelleConfig error:', error);
    throw error;
  }
};

export const getOrders = async (params = {}) => {
  try {
    const query = new URLSearchParams();
    if (params.storeId) query.append('storeId', params.storeId);
    if (params.ids) query.append('ids', params.ids);

    const queryString = query.toString();
    const url = queryString ? `${API_URL}/orders?${queryString}` : `${API_URL}/orders`;

    const response = await fetch(url, { headers: adminHeaders() });
    // [] y no null: quien llama hace orders.length / ordersData.reduce(...)
    // sobre lo que devolvamos (AdminDirectory.jsx, AdminDashboard.jsx). Un
    // null ahí revienta el render en vez de degradar.
    if (handleAuthFailure(response)) return [];
    if (!response.ok) throw new Error('Error al obtener órdenes');
    return await response.json();
  } catch (error) {
    console.error('API getOrders error:', error);
    throw error;
  }
};

export const getUsers = async () => {
  try {
    const response = await fetch(`${API_URL}/users`, { headers: adminHeaders() });
    if (handleAuthFailure(response)) return [];
    if (!response.ok) throw new Error('Error al obtener usuarios');
    return await response.json();
  } catch (error) {
    console.error('API getUsers error:', error);
    return [];
  }
};

export const deleteUser = async (id) => {
  try {
    const response = await fetch(`${API_URL}/users/${id}`, {
      method: 'DELETE',
      headers: adminHeaders()
    });
    if (handleAuthFailure(response)) return null;
    if (!response.ok) throw new Error('Error al eliminar usuario');
    return await response.json();
  } catch (error) {
    console.error('API deleteUser error:', error);
    throw error;
  }
};

export const updateUser = async (id, data) => {
  try {
    const response = await fetch(`${API_URL}/users/${id}`, {
      method: 'PUT',
      headers: adminHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data)
    });
    if (handleAuthFailure(response)) return null;
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Error al actualizar usuario');
    }
    return await response.json();
  } catch (error) {
    console.error('API updateUser error:', error);
    throw error;
  }
};

export const getSettings = async () => {
  try {
    const response = await fetch(`${API_URL}/settings`);
    if (!response.ok) throw new Error('Error al obtener configuraciones');
    return await response.json();
  } catch (error) {
    console.error('API getSettings error:', error);
    throw error;
  }
};

export const updateSetting = async (key, value) => {
  try {
    const response = await fetch(`${API_URL}/settings`, {
      method: 'POST',
      headers: adminHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ key, value })
    });
    if (handleAuthFailure(response)) return null;
    if (!response.ok) throw new Error('Error al actualizar configuración');
    return await response.json();
  } catch (error) {
    console.error('API updateSetting error:', error);
    throw error;
  }
};

export const uploadImage = async (file) => {
  try {
    const formData = new FormData();
    formData.append('image', file);
    
    const response = await fetch(`${API_URL}/upload`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.details 
        ? `${errorData.error} - Detalles: ${JSON.stringify(errorData.details)}` 
        : (errorData.error || 'Error al subir la imagen');
      throw new Error(errorMessage);
    }
    return await response.json();
  } catch (error) {
    console.error('API uploadImage error:', error);
    throw error;
  }
};
