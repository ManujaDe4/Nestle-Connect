const express = require("express");
const router = express.Router();
const {
  startRedemption,
  verifyOtpAndRedeem,
} = require("../controllers/redemptionController");

router.post("/start", startRedemption);
router.post("/verify", verifyOtpAndRedeem);

module.exports = router;