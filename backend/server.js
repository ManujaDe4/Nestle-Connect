const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const voucherRoutes = require("./routes/vouchers");
const shopRoutes = require("./routes/shops");
const redemptionRoutes = require("./routes/redemptions");
const dashboardRoutes = require("./routes/dashboard");
const smsRoutes = require("./routes/sms");
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const activityRoutes = require("./routes/activity");
const campaignRoutes = require("./routes/campaigns");
const { checkAndExpireCampaigns } = require("./controllers/campaignController");
const pool = require("./config/db");
const bcrypt = require("bcrypt");

const app = express();

/* =========================
   MIDDLEWARE
========================= */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

/* =========================
   API ROUTES
========================= */
app.use("/api/vouchers", voucherRoutes);
app.use("/api/shops", shopRoutes);
app.use("/api/redemptions", redemptionRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/sms", smsRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/campaigns", campaignRoutes);

/* =========================
   FRONTEND STATIC FILES
========================= */
const frontendPath = path.join(__dirname, "../frontend");
app.use(express.static(frontendPath));

/* =========================
   ROOT ROUTES
========================= */

// 1. Default Route: Directs Admin/Reps to the Login Portal
app.get("/", (req, res) => {
  res.sendFile(path.join(frontendPath, "login.html"));
});

// 2. Fallback App Route (Optional, directing to login as well)
app.get("/app", (req, res) => {
  res.sendFile(path.join(frontendPath, "login.html"));
});

// 3. Customer Route: Your social media ads should link to this URL!
// Example: https://nestle-connect.onrender.com/claim
app.get("/claim", (req, res) => {
  res.sendFile(path.join(frontendPath, "ad-entry.html"));
});
/* =========================
   DATABASE INITIALIZATION
========================= */
async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'rep')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      ALTER TABLE shops
      ADD COLUMN IF NOT EXISTS rep_id INTEGER REFERENCES users(id)
    `);

    await pool.query(`
      ALTER TABLE shops
      ADD COLUMN IF NOT EXISTS created_by_rep_id INTEGER REFERENCES users(id)
    `);

    await pool.query(`
      ALTER TABLE shops
      ADD COLUMN IF NOT EXISTS qr_identifier VARCHAR(100) UNIQUE
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        shop_id INTEGER REFERENCES shops(id),
        action VARCHAR(50) NOT NULL,
        detail TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const existingAdmin = await pool.query("SELECT id FROM users WHERE username = 'admin'");
    if (existingAdmin.rows.length === 0) {
      const passwordHash = await bcrypt.hash('password', 10);
      await pool.query(
        "INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)",
        ['admin', passwordHash, 'admin']
      );
      console.log('Created default admin user: admin / password');
    }
  } catch (error) {
    console.error('Database initialization failed:', error);
    process.exit(1);
  }
}

/* =========================
   SCHEDULED JOBS
========================= */
// Auto-expire campaigns every 5 minutes
setInterval(() => {
  checkAndExpireCampaigns();
}, 5 * 60 * 1000);

/* =========================
   SERVER START
========================= */
const PORT = process.env.PORT || 5000;

initDatabase().then(() => {
  // Run expiry check immediately on startup
  checkAndExpireCampaigns();
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log('✓ Campaign expiry job scheduled (checks every 5 minutes)');
  });
});