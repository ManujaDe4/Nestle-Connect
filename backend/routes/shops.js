const express = require("express");
const router = express.Router();
const {
  getShopBySlug,
  getAllShops,
  createShop,
  deleteShop,
  mapQRCode,
  getRegistrationLog,
  exportShopsCSV
} = require("../controllers/shopController");
const { authenticate, authorize } = require("../middleware/auth");

const ANY_STAFF = [
  "admin", "sys_admin", "sales_distributor",
  "digital_marketing_manager", "digital_content_specialist",
  "digital_media_performance_manager", "social_media_influencer_strategist",
  "crm_data_analyst", "digital_marketing_intern"
];

router.get("/", authenticate, getAllShops);
router.get("/export/csv", authenticate, authorize(ANY_STAFF), exportShopsCSV);
router.get("/log/registrations", authenticate, authorize(ANY_STAFF), getRegistrationLog);
router.get("/:slug", getShopBySlug);
router.post("/", authenticate, authorize(ANY_STAFF), createShop);
router.post("/map-qr", authenticate, authorize(ANY_STAFF), mapQRCode);
router.delete("/:id", authenticate, authorize(ANY_STAFF), deleteShop);

module.exports = router;
