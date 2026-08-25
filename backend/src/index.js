require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

// Vercel sits in front of this app as a single edge/proxy hop, so `req.ip`
// is the proxy's address unless Express is told to trust it. `1` trusts
// exactly that one hop's X-Forwarded-For entry (the real client) — not
// `true`, which would trust the whole chain and let a client forge its own
// X-Forwarded-For to dodge express-rate-limit's per-IP buckets. Without
// this, every request shares one bucket and the limiters in
// middleware/rate-limit.middleware.js throttle the whole platform instead
// of individual abusers.
app.set('trust proxy', 1);

// Middlewares
app.use(cors()); // Permite peticiones del frontend
app.use(express.json()); // Parsea JSON en el body de las peticiones
const path = require('path');
app.use('/images', express.static(path.join(__dirname, '../public/images')));

// Importar Rutas
const productRoutes = require('./routes/product.routes');
const authRoutes = require('./routes/auth.routes');
const orderRoutes = require('./routes/order.routes');
const storeRoutes = require('./routes/store.routes');
const userRoutes = require('./routes/user.routes');
const categoryRoutes = require('./routes/category.routes');
const settingsRoutes = require('./routes/settings.routes');
const uploadRoutes = require('./routes/upload.routes');

// Definir Rutas
app.use('/api/products', productRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/upload', uploadRoutes);

// Rutas de prueba
app.get('/', (req, res) => {
  res.json({ message: 'Bienvenido al backend de la Tienda Virtual Cuba' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Arrancar el servidor solo si no estamos en entorno Vercel (serverless)
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor backend corriendo en el puerto ${PORT}`);
  });
}

// Exportar la app para Vercel Serverless
module.exports = app;
