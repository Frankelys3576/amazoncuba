const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');

// GET /api/products - Listar todos los productos
router.get('/', productController.getProducts);

// GET /api/products/:id - Obtener un producto por ID
router.get('/:id', productController.getProductById);

// POST /api/products - Crear un nuevo producto
router.post('/', productController.createProduct);

module.exports = router;
