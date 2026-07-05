const express = require('express');
const router = express.Router();
const storeController = require('../controllers/store.controller');

// Rutas base: /api/stores
router.get('/', storeController.getStores);
router.get('/:id', storeController.getStoreById);

module.exports = router;
