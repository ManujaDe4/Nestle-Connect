const express = require('express');
const router = express.Router();
const {
  getTopCustomers,
  getShopPerformance,
  getRepPerformance,
  getRegionalManagerPerformance,
  getZonalManagerPerformance
} = require('../controllers/analyticsController');
const { authenticate, authorize } = require('../middleware/auth');

const DM_TEAM = [
  'admin', 'sys_admin',
  'digital_marketing_manager', 'digital_content_specialist',
  'digital_media_performance_manager', 'social_media_influencer_strategist',
  'crm_data_analyst', 'digital_marketing_intern'
];

const ASM_FSM_DM = [...DM_TEAM, 'area_sales_manager', 'field_sales_manager'];
const ASM_FSM    = ['area_sales_manager', 'field_sales_manager'];
const ASM_ONLY   = ['area_sales_manager'];

// Track A: top customers by redemption frequency — DM Team only
router.get('/customers/top', authenticate, authorize(DM_TEAM), getTopCustomers);

// Track B-A: shop sales volume — ASM + FSM + DM Team (territory-scoped in controller)
router.get('/shops/performance', authenticate, authorize(ASM_FSM_DM), getShopPerformance);

// Track B-B: rep performance — ASM + FSM (territory-scoped in controller)
router.get('/reps/performance', authenticate, authorize(ASM_FSM), getRepPerformance);

// Track B-C: regional manager performance — ASM only (scoped to province in controller)
router.get('/regional-managers/performance', authenticate, authorize(ASM_ONLY), getRegionalManagerPerformance);

// Track B-D: zonal manager performance — DM Team only
router.get('/zonal-managers/performance', authenticate, authorize(DM_TEAM), getZonalManagerPerformance);

module.exports = router;
