const express = require('express');
const router = express.Router();
const { getUsers, deleteUser, updateUser } = require('../controllers/user.controller');

router.get('/', getUsers);
router.delete('/:id', deleteUser);
router.put('/:id', updateUser);

module.exports = router;
