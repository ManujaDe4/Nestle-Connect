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

const ANY_STAFF = ["sales_distributor", "admin"];

router.get("/", authenticate, getAllShops);
router.get("/export/csv", authenticate, authorize(ANY_STAFF), exportShopsCSV);
router.get("/log/registrations", authenticate, authorize(["admin"]), getRegistrationLog);
router.get("/:slug", getShopBySlug);
router.post("/", authenticate, authorize(ANY_STAFF), createShop);
router.post("/map-qr", authenticate, authorize(ANY_STAFF), mapQRCode);
router.delete("/:id", authenticate, authorize(ANY_STAFF), deleteShop);

module.exports = router;
