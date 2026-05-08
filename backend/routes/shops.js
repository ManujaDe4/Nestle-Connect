const express = require("express");
const router = express.Router();
const { getShopBySlug, getAllShops, createShop, deleteShop, mapQRCode, getRegistrationLog, exportShopsCSV } = require("../controllers/shopController");
const { authenticate, authorize } = require("../middleware/auth");

router.get("/", authenticate, getAllShops);
router.get("/export/csv", authenticate, authorize(['sales_distributor', 'admin']), exportShopsCSV);
router.get("/log/registrations", authenticate, authorize(['admin']), getRegistrationLog);
router.get("/:slug", getShopBySlug);
router.post("/", authenticate, authorize(['sales_distributor', 'admin']), createShop);
router.post("/map-qr", authenticate, authorize(['sales_distributor', 'admin']), mapQRCode);
router.delete("/:id", authenticate, authorize(['admin', 'sales_distributor']), deleteShop);

module.exports = router;