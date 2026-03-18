const express = require("express");
const router = express.Router();
const { claimVoucher } = require("../controllers/voucherController");

router.post("/claim", claimVoucher);

module.exports = router;