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
    const response = await fetch(`${API_URL}/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
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
    const response = await fetch(`${API_URL}/stores/${id}`);
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
  const response = await fetch(`${API_URL}/stores/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
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
    throw new Error(errorData.error || 'Error al subir la imagen');
  }

  const data = await response.json();
  return data;
};
