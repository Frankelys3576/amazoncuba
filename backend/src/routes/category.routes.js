const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/category.controller');

// Rutas para categorías
router.get('/', categoryController.getCategories);

module.exports = router;
