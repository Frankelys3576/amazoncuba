const getBaseApiUrl = () => {
  if (import.meta.env.PROD) {
    // Esta app se despliega como proyecto propio, en otro dominio, así que no
    // puede usar una ruta relativa: apunta al dominio donde el vercel.json de
    // la raíz publica el backend. Antes apuntaba a
    // https://backend-lilac-xi-77.vercel.app/api, un despliegue que ya no se
    // actualiza desde main.
    return 'https://www.amasoncubano.com/api';
  }
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return `http://${window.location.hostname}:5001/api`;
  }
  return 'http://localhost:5001/api';
};

const API_URL = import.meta.env.VITE_API_URL || getBaseApiUrl();

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

export const getCategories = async () => {
  try {
    const response = await fetch(`${API_URL}/categories`);
    if (!response.ok) throw new Error('Error al obtener categorías');
    return await response.json();
  } catch (error) {
    console.error('API getCategories error:', error);
    return [];
  }
};

export const createProduct = async (productData) => {
  try {
    const token = localStorage.getItem('seller_token');
    const response = await fetch(`${API_URL}/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(productData)
    });
    if (!response.ok) throw new Error('Error al crear el producto');
    return await response.json();
  } catch (error) {
    console.error('API createProduct error:', error);
    throw error;
  }
};

export const updateProduct = async (id, productData) => {
  try {
    const token = localStorage.getItem('seller_token');
    const response = await fetch(`${API_URL}/products/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(productData)
    });
    if (!response.ok) throw new Error('Error al actualizar producto');
    return await response.json();
  } catch (error) {
    console.error('API updateProduct error:', error);
    throw error;
  }
};

export const deleteProduct = async (id) => {
  try {
    const token = localStorage.getItem('seller_token');
    const response = await fetch(`${API_URL}/products/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (!response.ok) throw new Error('Error al eliminar producto');
    return await response.json();
  } catch (error) {
    console.error('API deleteProduct error:', error);
    throw error;
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

export const getStoreOrders = async (storeId) => {
  try {
    // El backend exige sesión de vendedor para ?storeId=: la ruta devolvía
    // antes los pedidos de cualquier tienda (con nombre, correo, teléfono y
    // dirección del cliente) a quien preguntara.
    const token = localStorage.getItem('seller_token');
    const response = await fetch(`${API_URL}/orders?storeId=${storeId}&t=${Date.now()}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    if (!response.ok) throw new Error('Error al obtener los pedidos');
    return await response.json();
  } catch (error) {
    console.error('API getStoreOrders error:', error);
    return [];
  }
};

export const getStoreStats = async (storeId) => {
  try {
    const token = localStorage.getItem('seller_token');
    const response = await fetch(`${API_URL}/stores/${storeId}/stats`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Error al obtener estadísticas de la tienda');
    return await response.json();
  } catch (error) {
    console.error('API getStoreStats error:', error);
    return { viewsToday: 0, viewsThisMonth: 0, viewsTotal: 0 };
  }
};

export const updateOrder = async (id, status) => {
  try {
    const response = await fetch(`${API_URL}/orders/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status })
    });
    if (!response.ok) throw new Error('Error al actualizar el pedido');
    return await response.json();
  } catch (error) {
    console.error('API updateOrder error:', error);
    throw error;
  }
};

export const deleteAccount = async (storeId) => {
  try {
    const token = localStorage.getItem('seller_token');
    const response = await fetch(`${API_URL}/auth/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ storeId })
    });
    if (!response.ok) throw new Error('Error al eliminar la cuenta');
    return await response.json();
  } catch (error) {
    console.error('API deleteAccount error:', error);
    throw error;
  }
};

export const getStores = async () => {
  try {
    const response = await fetch(`${API_URL}/stores`);
    if (!response.ok) throw new Error('Error al obtener tiendas');
    return await response.json();
  } catch (error) {
    console.error('API getStores error:', error);
    return [];
  }
};

export const getStoreById = async (id) => {
  try {
    // GET /api/stores/:id ahora devuelve 404 para una tienda pending/rejected
    // salvo que el llamante sea el vendedor dueño o un administrador. Todo el
    // panel del vendedor consulta SU PROPIA tienda con este helper -- incluso
    // justo tras registrarse, cuando la tienda sigue pending -- así que hay
    // que mandar el token del vendedor para que el backend reconozca la
    // propiedad.
    const token = localStorage.getItem('seller_token');
    const response = await fetch(`${API_URL}/stores/${id}`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });
    if (!response.ok) throw new Error('Error al obtener tienda');
    return await response.json();
  } catch (error) {
    console.error('API getStoreById error:', error);
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

export const updateStoreProfile = async (id, profileData) => {
  const token = localStorage.getItem('seller_token');
  const response = await fetch(`${API_URL}/stores/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(profileData)
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Error actualizando el perfil');
  }
  
  return await response.json();
};

export const uploadImage = async (imageFile) => {
  const formData = new FormData();
  formData.append('image', imageFile);

  const response = await fetch(`${API_URL}/upload`, {
    method: 'POST',
    // No need to set Content-Type header, fetch will automatically set it to multipart/form-data with the correct boundary
    body: formData
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.details 
      ? `${errorData.error} - Detalles: ${JSON.stringify(errorData.details)}` 
      : (errorData.error || 'Error al subir la imagen');
    throw new Error(errorMessage);
  }

  const data = await response.json();
  return data;
};

// --- Store Categories ---
export const getStoreCategories = async (storeId) => {
  try {
    const response = await fetch(`${API_URL}/stores/${storeId}/categories`);
    if (!response.ok) throw new Error('Error fetching store categories');
    return await response.json();
  } catch (error) {
    console.error('Error fetching store categories:', error);
    throw error;
  }
};

export const createStoreCategory = async (storeId, categoryData) => {
  try {
    const token = localStorage.getItem('seller_token');
    const response = await fetch(`${API_URL}/stores/${storeId}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(categoryData),
    });
    if (!response.ok) throw new Error('Error creating store category');
    return await response.json();
  } catch (error) {
    console.error('Error creating store category:', error);
    throw error;
  }
};

export const updateStoreCategory = async (storeId, categoryId, categoryData) => {
  try {
    const token = localStorage.getItem('seller_token');
    const response = await fetch(`${API_URL}/stores/${storeId}/categories/${categoryId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(categoryData),
    });
    if (!response.ok) throw new Error('Error updating store category');
    return await response.json();
  } catch (error) {
    console.error('Error updating store category:', error);
    throw error;
  }
};

export const deleteStoreCategory = async (storeId, categoryId) => {
  try {
    const token = localStorage.getItem('seller_token');
    const response = await fetch(`${API_URL}/stores/${storeId}/categories/${categoryId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Error deleting store category');
    return await response.json();
  } catch (error) {
    console.error('Error deleting store category:', error);
    throw error;
  }
};

export const updateCredentials = async (storeId, credentialsData) => {
  try {
    const token = localStorage.getItem('seller_token');
    const response = await fetch(`${API_URL}/stores/${storeId}/credentials`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(credentialsData),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Error updating credentials');
    }
    return await response.json();
  } catch (error) {
    console.error('Error updating credentials:', error);
    throw error;
  }
};
