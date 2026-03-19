const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const voucherRoutes = require("./routes/vouchers");
const shopRoutes = require("./routes/shops");
const redemptionRoutes = require("./routes/redemptions");
const dashboardRoutes = require("./routes/dashboard");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/vouchers", voucherRoutes);
app.use("/api/shops", shopRoutes);
app.use("/api/redemptions", redemptionRoutes);
app.use("/api/dashboard", dashboardRoutes);

app.use(express.static(path.join(__dirname, "../frontend")));

app.get("/", (req, res) => {
  res.send("Nestle Connect MVP Backend Running");
});

app.get("/app", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/ad-entry.html"));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});