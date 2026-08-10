const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');

// GET /api/products - Listar todos los productos
router.get('/', productController.getProducts);

// GET /api/products/:id - Obtener un producto por ID
router.get('/:id', productController.getProductById);

// POST /api/products - Crear un nuevo producto
router.post('/', productController.createProduct);

// DELETE /api/products/:id
router.delete('/:id', productController.deleteProduct);

// PUT /api/products/:id - Actualizar un producto
router.put('/:id', productController.updateProduct);

// POST /api/products/:id/view - Registrar una vista de producto
router.post('/:id/view', productController.registerProductView);

// GET /api/products/:id/reviews - Obtener reseñas de un producto
router.get('/:id/reviews', productController.getProductReviews);

// POST /api/products/:id/reviews - Añadir una reseña
router.post('/:id/reviews', productController.addProductReview);

module.exports = router;
