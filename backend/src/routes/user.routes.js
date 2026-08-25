const express = require('express');
const router = express.Router();
const { getUsers, deleteUser, updateUser } = require('../controllers/user.controller');
const { authenticateAdmin } = require('../middleware/auth.middleware');

router.get('/', authenticateAdmin, getUsers);
router.delete('/:id', authenticateAdmin, deleteUser);
router.put('/:id', authenticateAdmin, updateUser);

module.exports = router;
