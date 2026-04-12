const express = require('express');
const router = express.Router();
const { getAllUsers, createUser, deleteUser } = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, authorize(['admin']), getAllUsers);
router.post('/', authenticate, authorize(['admin']), createUser);
router.delete('/:id', authenticate, authorize(['admin']), deleteUser);

module.exports = router;