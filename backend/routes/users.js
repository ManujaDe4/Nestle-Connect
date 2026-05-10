const express = require('express');
const router = express.Router();
const { getAllUsers, createUser, deleteUser, purgeAllUsers, getMyProfile, updateMyProfile, updateUserPermissions } = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');

const MANAGERS = ['admin', 'sys_admin', 'area_sales_manager', 'field_sales_manager'];
const ADMINS_ONLY = ['admin', 'sys_admin'];

router.get('/me', authenticate, getMyProfile);
router.put('/me', authenticate, updateMyProfile);
router.get('/', authenticate, authorize(MANAGERS), getAllUsers);
router.post('/', authenticate, authorize(MANAGERS), createUser);
router.put('/:id/permissions', authenticate, authorize(MANAGERS), updateUserPermissions);
router.delete('/purge-all', authenticate, authorize(ADMINS_ONLY), purgeAllUsers);
router.delete('/:id', authenticate, authorize(MANAGERS), deleteUser);

module.exports = router;
