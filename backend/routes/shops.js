const express = require("express");
const router = express.Router();
const { getShopBySlug, getAllShops, createShop, deleteShop } = require("../controllers/shopController");
const { authenticate, authorize } = require("../middleware/auth");

router.get("/", authenticate, getAllShops);
router.get("/:slug", getShopBySlug);
router.post("/", authenticate, authorize(['rep', 'admin']), createShop);
router.delete("/:id", authenticate, authorize(['admin']), deleteShop);

module.exports = router;