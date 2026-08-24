const express = require('express');
const router = express.Router();
const { getUsers, deleteUser, updateUser } = require('../controllers/user.controller');
const { requireAdmin } = require('../middleware/auth.middleware');

router.get('/', requireAdmin, getUsers);
router.delete('/:id', requireAdmin, deleteUser);
router.put('/:id', requireAdmin, updateUser);

module.exports = router;
