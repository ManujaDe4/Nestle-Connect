const express = require('express');
const router = express.Router();
const {
  allocateReward,
  getAllocations,
  distributeReward,
  getDistributions,
  getMyRewards,
  getRewardAudit
} = require('../controllers/rewardsController');
const { authenticate, authorize } = require('../middleware/auth');

const DM_TEAM = [
  'admin', 'sys_admin',
  'digital_marketing_manager', 'digital_content_specialist',
  'digital_media_performance_manager', 'social_media_influencer_strategist',
  'crm_data_analyst', 'digital_marketing_intern'
];

const ADMIN_DM = [...DM_TEAM]; // admin/sys_admin already included above
const ASM_ONLY = ['area_sales_manager'];

// DM Team issues a top-level reward to an ASM
router.post('/allocate', authenticate, authorize(DM_TEAM), allocateReward);

// DM Team: all allocations. ASM: their own. (Controller applies the filter.)
router.get('/allocations', authenticate, authorize([...DM_TEAM, 'area_sales_manager']), getAllocations);

// ASM cascades reward down to FSM / SD / Shop
router.post('/distribute', authenticate, authorize(ASM_ONLY), distributeReward);

// Role-scoped in controller: ASM sees issued, FSM/SD see received, admin/DM Team see all
router.get('/distributions', authenticate, getDistributions);

// Any authenticated user views their own received rewards
router.get('/my-rewards', authenticate, getMyRewards);

// Full audit trail — admin + DM Team only
router.get('/audit', authenticate, authorize(ADMIN_DM), getRewardAudit);

module.exports = router;
