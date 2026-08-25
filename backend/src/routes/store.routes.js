const express = require('express');
const router = express.Router();
const storeController = require('../controllers/store.controller');
const storeCategoryController = require('../controllers/storeCategory.controller');
const { authenticateSeller, requireStoreOwnership, authenticateAdmin } = require('../middleware/auth.middleware');

// Rutas base: /api/stores
router.get('/', storeController.getStores);
router.get('/:id', storeController.getStoreById);
router.get('/:id/admin-details', authenticateAdmin, storeController.getAdminStoreDetails);
router.put('/:id/status', authenticateAdmin, storeController.updateStoreStatus);
router.put('/:id/zelle', authenticateAdmin, storeController.updateZelleInfo);
router.put('/:id/credentials', authenticateSeller, requireStoreOwnership, storeController.updateStoreCredentials);
router.put('/:id', authenticateSeller, requireStoreOwnership, storeController.updateStoreProfile);
router.get('/:id/stats', storeController.getStoreStats);

// Rutas de categorías personalizadas (solo el dueño de la tienda puede modificarlas)
router.get('/:id/categories', storeCategoryController.getStoreCategories);
router.post('/:id/categories', authenticateSeller, requireStoreOwnership, storeCategoryController.createStoreCategory);
router.put('/:id/categories/:categoryId', authenticateSeller, requireStoreOwnership, storeCategoryController.updateStoreCategory);
router.delete('/:id/categories/:categoryId', authenticateSeller, requireStoreOwnership, storeCategoryController.deleteStoreCategory);

module.exports = router;
