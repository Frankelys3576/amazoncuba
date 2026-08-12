// SVG data URI placeholder that says "Sin foto disponible"
export const NO_PHOTO_PLACEHOLDER = `data:image/svg+xml,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <rect width="400" height="400" fill="#f1f5f9"/>
  <rect x="140" y="120" width="120" height="90" rx="8" fill="none" stroke="#94a3b8" stroke-width="3"/>
  <circle cx="170" cy="148" r="10" fill="#94a3b8"/>
  <path d="M145 200 L175 170 L205 195 L225 175 L255 200" fill="none" stroke="#94a3b8" stroke-width="3" stroke-linejoin="round"/>
  <text x="200" y="260" text-anchor="middle" font-family="system-ui,sans-serif" font-size="18" font-weight="600" fill="#64748b">Sin foto disponible</text>
</svg>
`)}`;

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
