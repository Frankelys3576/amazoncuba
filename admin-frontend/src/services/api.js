const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://tienda-cuba-amazon.vercel.app/api' : 'http://localhost:5001/api');

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

export const updateStoreStatus = async (id, status) => {
  try {
    const response = await fetch(`${API_URL}/stores/${id}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status })
    });
    if (!response.ok) throw new Error('Error al actualizar estado de la tienda');
    return await response.json();
  } catch (error) {
    console.error('API updateStoreStatus error:', error);
    throw error;
  }
};
