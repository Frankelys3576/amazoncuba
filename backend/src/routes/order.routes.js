const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');

// GET /api/orders
router.get('/', orderController.getOrders);

// POST /api/orders
router.post('/', orderController.createOrder);

module.exports = router;
