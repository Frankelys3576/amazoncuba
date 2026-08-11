export const DEFAULT_PRODUCT_FALLBACK = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80';

export const getValidImageUrl = (url, fallback = DEFAULT_PRODUCT_FALLBACK) => {
  if (!url || typeof url !== 'string' || url.trim() === '') {
    return fallback;
  }
  
  let cleanUrl = url.trim();
  
  // Convert http:// to https:// to prevent Mixed Content blocking in modern browsers
  if (cleanUrl.startsWith('http://')) {
    cleanUrl = cleanUrl.replace('http://', 'https://');
  }

  return cleanUrl;
};

export const handleImageError = (e, fallback = DEFAULT_PRODUCT_FALLBACK) => {
  if (e.target && e.target.src !== fallback) {
    e.target.onerror = null; // Prevent infinite fallback loops if fallback itself fails
    e.target.src = fallback;
  }
};
