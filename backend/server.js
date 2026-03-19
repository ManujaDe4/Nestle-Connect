const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const voucherRoutes = require("./routes/vouchers");
const shopRoutes = require("./routes/shops");
const redemptionRoutes = require("./routes/redemptions");
const dashboardRoutes = require("./routes/dashboard");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes
app.use("/api/vouchers", voucherRoutes);
app.use("/api/shops", shopRoutes);
app.use("/api/redemptions", redemptionRoutes);
app.use("/api/dashboard", dashboardRoutes);

// Serve static frontend files
app.use(express.static(path.join(__dirname, "../frontend")));

// Root route (opens your landing page)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/ad-entry.html"));
});

// Optional: fallback route (helps avoid blank page errors)
app.get("*", (req, res) => {
  res.status(404).send("Route not found");
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});