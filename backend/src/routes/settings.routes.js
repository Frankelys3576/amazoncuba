const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settings.controller');

// Rutas base: /api/settings
router.get('/', settingsController.getSettings);
router.post('/', settingsController.updateSetting);

module.exports = router;
