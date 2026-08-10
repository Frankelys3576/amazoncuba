const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');

// GET /api/orders
router.get('/', orderController.getOrders);

// POST /api/orders
router.post('/', orderController.createOrder);

// PUT /api/orders/:id
router.put('/:id', orderController.updateOrder);

module.exports = router;
