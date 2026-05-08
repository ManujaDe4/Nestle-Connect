const express = require('express');
const router = express.Router();
const {
  createCampaign,
  updateCampaign,
  getAllCampaigns,
  getActiveCampaigns,
  getCampaignById,
  expireCampaign,
  getCampaignStats,
  deleteCampaign
} = require('../controllers/campaignController');

const { authenticate, authorize } = require('../middleware/auth');

const STAFF = ['admin', 'sys_admin', 'digital_marketing_manager', 'digital_content_specialist',
               'digital_media_performance_manager', 'social_media_influencer_strategist',
               'crm_data_analyst', 'digital_marketing_intern'];

router.post('/', authenticate, authorize(STAFF), createCampaign);
router.put('/:id', authenticate, authorize(STAFF), updateCampaign);
router.get('/', getAllCampaigns);
router.get('/active', getActiveCampaigns);
router.get('/:campaign_id', getCampaignById);
router.post('/expire', authenticate, authorize(STAFF), expireCampaign);
router.get('/:campaign_id/stats', authenticate, authorize(STAFF), getCampaignStats);
router.delete('/:campaign_id', authenticate, authorize(STAFF), deleteCampaign);

module.exports = router;
