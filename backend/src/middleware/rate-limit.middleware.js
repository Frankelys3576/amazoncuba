const rateLimit = require('express-rate-limit');

// AVISO: en Vercel cada invocación puede ser una instancia distinta, así que
// este contador en memoria limita POR INSTANCIA, no globalmente. Sube mucho el
// coste de abusar de estas rutas, pero NO es una garantía. Un límite real
// necesitaría un almacén compartido (Redis), que hoy no compensa.
const build = (windowMs, limit) => rateLimit({
  windowMs,
  limit,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones. Inténtalo de nuevo más tarde.' }
});

const loginLimiter = build(15 * 60 * 1000, 10);
const reviewLimiter = build(60 * 60 * 1000, 5);
const viewLimiter = build(60 * 60 * 1000, 60);
const uploadLimiter = build(60 * 60 * 1000, 20);

module.exports = { loginLimiter, reviewLimiter, viewLimiter, uploadLimiter };
