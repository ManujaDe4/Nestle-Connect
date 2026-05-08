const express = require("express");
const router = express.Router();
const { getDashboardSummary, getAdminDashboard } = require("../controllers/dashboardController");
const { authenticate, authorize } = require("../middleware/auth");

const STAFF = ['admin', 'sys_admin', 'digital_marketing_manager', 'digital_content_specialist',
               'digital_media_performance_manager', 'social_media_influencer_strategist',
               'crm_data_analyst', 'digital_marketing_intern'];

router.get("/summary", authenticate, authorize([...STAFF, "sales_distributor"]), getDashboardSummary);
router.get("/admin", authenticate, authorize(STAFF), getAdminDashboard);

module.exports = router;
