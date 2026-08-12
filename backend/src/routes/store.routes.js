const express = require('express');
const router = express.Router();
const storeController = require('../controllers/store.controller');
const storeCategoryController = require('../controllers/storeCategory.controller');

// Rutas base: /api/stores
router.get('/', storeController.getStores);
router.get('/:id', storeController.getStoreById);
router.get('/:id/admin-details', storeController.getAdminStoreDetails);
router.put('/:id/status', storeController.updateStoreStatus);
router.put('/:id/zelle', storeController.updateZelleInfo);
router.put('/:id/credentials', storeController.updateStoreCredentials);
router.put('/:id', storeController.updateStoreProfile);
router.get('/:id/stats', storeController.getStoreStats);

// Rutas de categorías personalizadas
router.get('/:id/categories', storeCategoryController.getStoreCategories);
router.post('/:id/categories', storeCategoryController.createStoreCategory);
router.put('/:id/categories/:categoryId', storeCategoryController.updateStoreCategory);
router.delete('/:id/categories/:categoryId', storeCategoryController.deleteStoreCategory);

module.exports = router;
