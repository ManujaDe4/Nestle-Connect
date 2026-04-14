const express = require('express');
const router = express.Router();
const { getActivityLog } = require('../controllers/activityController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, authorize(['admin']), getActivityLog);

module.exports = router;