const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const voucherRoutes = require("./routes/vouchers");
const shopRoutes = require("./routes/shops");
const redemptionRoutes = require("./routes/redemptions");
const dashboardRoutes = require("./routes/dashboard");
const smsRoutes = require("./routes/sms");

const app = express();

/* =========================
   MIDDLEWARE
========================= */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =========================
   API ROUTES
========================= */
app.use("/api/vouchers", voucherRoutes);
app.use("/api/shops", shopRoutes);
app.use("/api/redemptions", redemptionRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/sms", smsRoutes);

/* =========================
   FRONTEND STATIC FILES
========================= */
const frontendPath = path.join(__dirname, "../frontend");
app.use(express.static(frontendPath));

/* =========================
   ROOT ROUTE (IMPORTANT FIX)
========================= */
app.get("/", (req, res) => {
  res.sendFile(path.join(frontendPath, "ad-entry.html"));
});

/* OPTIONAL: direct app route */
app.get("/app", (req, res) => {
  res.sendFile(path.join(frontendPath, "ad-entry.html"));
});

/* =========================
   FALLBACK (OPTIONAL BUT NICE)
========================= */
app.get("*", (req, res) => {
  res.sendFile(path.join(frontendPath, "ad-entry.html"));
});

/* =========================
   SERVER START
========================= */
const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});