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

// Admin only routes
router.post('/', authenticate, authorize(['admin']), createCampaign);
router.put('/:id', authenticate, authorize(['admin']), updateCampaign);
router.get('/', getAllCampaigns);
router.get('/active', getActiveCampaigns);
router.get('/:campaign_id', getCampaignById);
router.post('/expire', authenticate, authorize(['admin']), expireCampaign);
router.get('/:campaign_id/stats', authenticate, authorize(['admin']), getCampaignStats);
router.delete('/:campaign_id', authenticate, authorize(['admin']), deleteCampaign);



module.exports = router;
