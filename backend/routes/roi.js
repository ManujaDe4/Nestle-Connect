const express = require('express');
const router = express.Router();
const { getROISummary, exportROIReport, getCampaignAnalytics } = require('../controllers/roiController');
const { authenticate, authorize } = require('../middleware/auth');

const STAFF = ['admin', 'sys_admin', 'digital_marketing_manager', 'digital_content_specialist',
               'digital_media_performance_manager', 'social_media_influencer_strategist',
               'crm_data_analyst', 'digital_marketing_intern'];

router.get('/summary', authenticate, authorize(STAFF), getROISummary);
router.get('/export', authenticate, authorize(STAFF), exportROIReport);
router.get('/campaign/:campaign_id', authenticate, authorize(STAFF), getCampaignAnalytics);

module.exports = router;
