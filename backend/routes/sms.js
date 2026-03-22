const express = require("express");
const router = express.Router();
const { getAllSMSLogs } = require("../controllers/smsController");

router.get("/", getAllSMSLogs);

module.exports = router;