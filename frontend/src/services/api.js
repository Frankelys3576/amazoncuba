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

export const getProducts = async (params = {}) => {
  try {
    const query = new URLSearchParams();
    if (params.storeId) query.append('storeId', params.storeId);
    if (params.q) query.append('q', params.q);
    if (params.category) query.append('category', params.category);
    if (params.province) query.append('province', params.province);
    if (params.municipality) query.append('municipality', params.municipality);

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

export const getOrdersByIds = async (ids) => {
  try {
    const response = await fetch(`${API_URL}/orders?ids=${ids.join(',')}`);
    if (!response.ok) throw new Error('Error al obtener los pedidos');
    return await response.json();
  } catch (error) {
    console.error('API getOrdersByIds error:', error);
    return [];
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

export const getStores = async (type = 'business') => {
  try {
    const response = await fetch(`${API_URL}/stores?type=${type}`);
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

export const registerProductView = async (id) => {
  try {
    const response = await fetch(`${API_URL}/products/${id}/view`, {
      method: 'POST'
    });
    if (!response.ok) throw new Error('Error al registrar la vista del producto');
    return await response.json();
  } catch (error) {
    // Es un error silencioso, no es necesario interrumpir la UX
    console.error('API registerProductView error:', error);
    return null;
  }
};

export const getProductReviews = async (id) => {
  try {
    const response = await fetch(`${API_URL}/products/${id}/reviews`);
    if (!response.ok) throw new Error('Error fetching reviews');
    return await response.json();
  } catch (error) {
    console.error('API getProductReviews error:', error);
    return [];
  }
};

export const addProductReview = async (id, reviewData) => {
  try {
    const response = await fetch(`${API_URL}/products/${id}/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(reviewData)
    });
    if (!response.ok) throw new Error('Error submitting review');
    return await response.json();
  } catch (error) {
    console.error('API addProductReview error:', error);
    return null;
  }
};

export const getStoreCategories = async (storeId) => {
  try {
    const response = await fetch(`${API_URL}/stores/${storeId}/categories`);
    if (!response.ok) throw new Error('Error fetching store categories');
    return await response.json();
  } catch (error) {
    console.error('Error fetching store categories:', error);
    return [];
  }
};
export const getSettings = async () => {
  try {
    const response = await fetch(`${API_URL}/settings`);
    if (!response.ok) throw new Error('Error al obtener configuraciones');
    return await response.json();
  } catch (error) {
    console.error('API getSettings error:', error);
    return {};
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
