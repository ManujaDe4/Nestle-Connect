const express = require("express");
const router = express.Router();
const { getShopBySlug, getAllShops, createShop } = require("../controllers/shopController");

router.get("/", getAllShops);
router.get("/:slug", getShopBySlug);
router.post("/", createShop);

module.exports = router;