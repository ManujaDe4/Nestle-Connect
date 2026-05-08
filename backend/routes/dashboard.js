const express = require("express");
const router = express.Router();
const { getDashboardSummary, getAdminDashboard } = require("../controllers/dashboardController");
const { authenticate, authorize } = require("../middleware/auth");

router.get("/summary", authenticate, authorize(["admin", "sales_distributor"]), getDashboardSummary);
router.get("/admin", authenticate, authorize(["admin"]), getAdminDashboard);

module.exports = router;
