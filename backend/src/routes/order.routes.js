const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');
const { authorizeOrdersQuery, authorizeOrderUpdate } = require('../middleware/auth.middleware');

// GET /api/orders
router.get('/', authorizeOrdersQuery, orderController.getOrders);

// POST /api/orders
router.post('/', orderController.createOrder);

// PUT /api/orders/:id
router.put('/:id', authorizeOrderUpdate, orderController.updateOrder);

module.exports = router;
