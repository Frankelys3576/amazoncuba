const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');
const { authenticateSeller } = require('../middleware/auth.middleware');
const { reviewLimiter, viewLimiter } = require('../middleware/rate-limit.middleware');

// GET /api/products - Listar todos los productos
router.get('/', productController.getProducts);

// GET /api/products/:id - Obtener un producto por ID
router.get('/:id', productController.getProductById);

// POST /api/products - Crear un nuevo producto
router.post('/', authenticateSeller, productController.createProduct);

// DELETE /api/products/:id
router.delete('/:id', authenticateSeller, productController.deleteProduct);

// PUT /api/products/:id - Actualizar un producto
router.put('/:id', authenticateSeller, productController.updateProduct);

// POST /api/products/:id/view - Registrar una vista de producto
router.post('/:id/view', viewLimiter, productController.registerProductView);

// GET /api/products/:id/reviews - Obtener reseñas de un producto
router.get('/:id/reviews', productController.getProductReviews);

// POST /api/products/:id/reviews - Añadir una reseña
router.post('/:id/reviews', reviewLimiter, productController.addProductReview);

module.exports = router;
