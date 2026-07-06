const express = require('express');
const router = express.Router();
const storeController = require('../controllers/store.controller');

// Rutas base: /api/stores
router.get('/', storeController.getStores);
router.get('/:id', storeController.getStoreById);
router.put('/:id/status', storeController.updateStoreStatus);
router.put('/:id', storeController.updateStoreProfile);

module.exports = router;
