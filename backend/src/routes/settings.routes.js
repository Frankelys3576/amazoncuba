const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settings.controller');
const { requireAdmin } = require('../middleware/auth.middleware');

// Rutas base: /api/settings
router.get('/', settingsController.getSettings);
router.post('/', requireAdmin, settingsController.updateSetting);

module.exports = router;
