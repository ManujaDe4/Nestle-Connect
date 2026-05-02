const express = require("express");
const router = express.Router();
const { getShopBySlug, getAllShops, createShop, deleteShop, mapQRCode, getRegistrationLog, exportShopsCSV } = require("../controllers/shopController");
const { authenticate, authorize } = require("../middleware/auth");

router.get("/", authenticate, getAllShops);
router.get("/export/csv", authenticate, authorize(['rep', 'admin']), exportShopsCSV);
router.get("/log/registrations", authenticate, authorize(['admin']), getRegistrationLog);
router.get("/:slug", getShopBySlug);
router.post("/", authenticate, authorize(['rep', 'admin']), createShop);
router.post("/map-qr", authenticate, authorize(['rep', 'admin']), mapQRCode);
router.delete("/:id", authenticate, authorize(['admin', 'rep']), deleteShop);

module.exports = router;