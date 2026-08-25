const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticateSeller } = require('../middleware/auth.middleware');
const { loginLimiter } = require('../middleware/rate-limit.middleware');

// POST /api/auth/register
router.post('/register', authController.register);

// POST /api/auth/login
router.post('/login', loginLimiter, authController.login);

// POST /api/auth/delete
router.post('/delete', authenticateSeller, authController.deleteAccount);

module.exports = router;
