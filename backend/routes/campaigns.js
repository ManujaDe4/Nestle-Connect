const express = require('express');
const router = express.Router();
const { 
  createCampaign, 
  getAllCampaigns, 
  getActiveCampaigns,
  getCampaignById,
  expireCampaign,
  getCampaignStats 
} = require('../controllers/campaignController');
const { authenticate, authorize } = require('../middleware/auth');

// Admin only routes
router.post('/', authenticate, authorize(['admin']), createCampaign);
router.get('/', getAllCampaigns);
router.get('/active', getActiveCampaigns);
router.get('/:campaign_id', getCampaignById);
router.post('/expire', authenticate, authorize(['admin']), expireCampaign);
router.get('/:campaign_id/stats', authenticate, authorize(['admin']), getCampaignStats);

module.exports = router;
