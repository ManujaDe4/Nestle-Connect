const express = require("express");
const router = express.Router();
const { getShopBySlug, getAllShops, createShop, deleteShop, mapQRCode, getRegistrationLog } = require("../controllers/shopController");
const { authenticate, authorize } = require("../middleware/auth");

router.get("/", authenticate, getAllShops);
router.get("/:slug", getShopBySlug);
router.post("/", authenticate, authorize(['rep', 'admin']), createShop);
router.post("/map-qr", authenticate, authorize(['rep', 'admin']), mapQRCode);
router.get("/log/registrations", authenticate, authorize(['admin']), getRegistrationLog);
router.delete("/:id", authenticate, authorize(['admin']), deleteShop);

module.exports = router;