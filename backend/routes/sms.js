const express = require("express");
const router = express.Router();
const { getAllSMSLogs } = require("../controllers/smsController");
const { authenticate, authorize } = require("../middleware/auth");

// SMS logs include OTPs and customer voucher codes — admin only.
router.get("/", authenticate, authorize(["admin"]), getAllSMSLogs);

module.exports = router;
