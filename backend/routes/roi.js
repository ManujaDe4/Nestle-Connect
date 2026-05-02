const express = require('express');
const router = express.Router();
const { getROISummary, exportROIReport, getCampaignAnalytics } = require('../controllers/roiController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/summary', authenticate, authorize(['admin']), getROISummary);
router.get('/export', authenticate, authorize(['admin']), exportROIReport);
router.get('/campaign/:campaign_id', authenticate, authorize(['admin']), getCampaignAnalytics);

module.exports = router;

