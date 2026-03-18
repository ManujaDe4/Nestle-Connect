const express = require("express");
const router = express.Router();
const { getShopBySlug } = require("../controllers/shopController");

router.get("/:slug", getShopBySlug);

module.exports = router;