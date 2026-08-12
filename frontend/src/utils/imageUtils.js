// SVG data URI placeholder that says "Sin foto disponible"
export const NO_PHOTO_PLACEHOLDER = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iNDAwIiB2aWV3Qm94PSIwIDAgNDAwIDQwMCI+CiAgPHJlY3Qgd2lkdGg9IjQwMCIgaGVpZ2h0PSI0MDAiIGZpbGw9IiNmMWY1ZjkiLz4KICA8cmVjdCB4PSIxNDAiIHk9IjEyMCIgd2lkdGg9IjEyMCIgaGVpZ2h0PSI5MCIgcng9IjgiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzk0YTNiOCIgc3Ryb2tlLXdpZHRoPSIzIi8+CiAgPGNpcmNsZSBjeD0iMTcwIiBjeT0iMTQ4IiByPSIxMCIgZmlsbD0iIzk0YTNiOCIvPgogIDxwYXRoIGQ9Ik0xNDUgMjAwIEwxNzUgMTcwIEwyMDUgMTk1IEwyMjUgMTc1IEwyNTUgMjAwIiBmaWxsPSJub25lIiBzdHJva2U9IiM5NGEzYjgiIHN0cm9rZS13aWR0aD0iMyIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgogIDx0ZXh0IHg9IjIwMCIgeT0iMjYwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0ic3lzdGVtLXVpLHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTgiIGZvbnQtd2VpZ2h0PSI2MDAiIGZpbGw9IiM2NDc0OGIiPlNpbiBmb3RvIGRpc3BvbmlibGU8L3RleHQ+Cjwvc3ZnPg==';

export const DEFAULT_PRODUCT_FALLBACK = NO_PHOTO_PLACEHOLDER;

// Detect broken/unreachable URLs (local IPs, localhost references, etc.)
const isUnreachableUrl = (url) => {
  if (!url) return true;
  // Match private/local IP addresses and localhost
  return /^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|127\.|localhost)/i.test(url);
};

export const getValidImageUrl = (url, fallback = DEFAULT_PRODUCT_FALLBACK) => {
  if (!url || typeof url !== 'string' || url.trim() === '') {
    return fallback;
  }
  
  let cleanUrl = url.trim();

  if (cleanUrl === 'null' || cleanUrl === 'undefined') {
    return fallback;
  }

  // If it's a local/private network URL, return placeholder immediately
  if (isUnreachableUrl(cleanUrl)) {
    return fallback;
  }
  
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
    e.target.style.objectFit = 'contain';
    e.target.style.backgroundColor = '#f1f5f9';
  }
};
