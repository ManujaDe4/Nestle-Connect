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
const roiRoutes = require("./routes/roi");
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
app.use("/api/roi", roiRoutes);

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
    /* =========================================================
       PHASE 1 — ROLE MIGRATION  (rep → sales_distributor)
       Runs idempotently: safe to execute on every startup.
       ========================================================= */

    // 1a. Drop the old CHECK constraint on users.role (if it still allows 'rep')
    const constraintResult = await pool.query(`
      SELECT con.conname
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
      WHERE rel.relname = 'users'
        AND con.contype = 'c'
        AND pg_get_constraintdef(con.oid) ILIKE '%rep%'
    `);

    if (constraintResult.rows.length > 0) {
      for (const row of constraintResult.rows) {
        await pool.query(`ALTER TABLE users DROP CONSTRAINT "${row.conname}"`);
        console.log(`  ↳ Dropped old constraint: ${row.conname}`);
      }
      // Convert rep rows BEFORE adding the new constraint
      const repConvert = await pool.query(`
        UPDATE users SET role = 'sales_distributor' WHERE role = 'rep'
      `);
      if (repConvert.rowCount > 0) {
        console.log(`✓ Converted ${repConvert.rowCount} rep row(s) to sales_distributor`);
      }
      // Now add the new constraint
      await pool.query(`
        ALTER TABLE users ADD CONSTRAINT users_role_check
        CHECK (role IN ('admin', 'sales_distributor'))
      `);
      console.log('✓ Role constraint migrated (admin, sales_distributor)');
    }

    // 1c. Rename REP-… employee IDs to SD-…
    const idRename = await pool.query(`
      UPDATE users SET employee_id = 'SD-' || SUBSTRING(employee_id FROM 5)
      WHERE employee_id LIKE 'REP-%'
    `);
    if (idRename.rowCount > 0) {
      console.log(`✓ Renamed ${idRename.rowCount} REP- employee ID(s) to SD-`);
    }

    // 1d. Rename the legacy 'admin' username to 'sysadmin'
    const sysAdminExists = await pool.query("SELECT id FROM users WHERE username = 'sysadmin'");
    if (sysAdminExists.rows.length === 0) {
      const adminRename = await pool.query(`
        UPDATE users SET username = 'sysadmin' WHERE username = 'admin'
      `);
      if (adminRename.rowCount > 0) {
        console.log('✓ Renamed admin user → sysadmin');
      }
    } else {
      // Delete legacy 'admin' to prevent duplicates or conflicts since 'sysadmin' exists
      await pool.query("DELETE FROM users WHERE username = 'admin'");
    }

    // 1e. Assign SYS-000001 to any admin missing an employee_id
    const sysIdAssign = await pool.query(`
      UPDATE users SET employee_id = 'SYS-000001'
      WHERE role = 'admin' AND (employee_id IS NULL OR employee_id = '')
    `);
    if (sysIdAssign.rowCount > 0) {
      console.log(`✓ Assigned SYS-000001 to ${sysIdAssign.rowCount} admin(s)`);
    }

    // 1f. Expand role constraint to include all digital marketing staff roles + field management roles
    try {
      await pool.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`);
      await pool.query(`
        ALTER TABLE users ADD CONSTRAINT users_role_check
        CHECK (role IN (
          'admin', 'sys_admin', 'sales_distributor',
          'digital_marketing_manager', 'digital_content_specialist',
          'digital_media_performance_manager', 'social_media_influencer_strategist',
          'crm_data_analyst', 'digital_marketing_intern',
          'area_sales_manager', 'field_sales_manager'
        ))
      `);
      console.log('✓ Role constraint updated with all staff roles');
    } catch (e) {
      console.log('Role constraint update skipped:', e.message);
    }

    /* =========================================================
       PHASE 2 — TABLE CREATION  (CREATE IF NOT EXISTS)
       ========================================================= */

    // 1. Users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        employee_id VARCHAR(50) UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        province VARCHAR(100),
        region VARCHAR(100),
        area VARCHAR(100),
        permissions JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Campaigns table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id SERIAL PRIMARY KEY,
        campaign_id VARCHAR(20) UNIQUE NOT NULL,
        campaign_name VARCHAR(100) NOT NULL,
        description TEXT,
        start_date TIMESTAMP NOT NULL,
        end_date TIMESTAMP NOT NULL,
        objective VARCHAR(50),
        target_audience VARCHAR(50),
        voucher_value VARCHAR(50),
        voucher_limit INTEGER,
        budget NUMERIC(10,2),
        banner_url VARCHAR(255),
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('draft', 'active', 'expired', 'disabled')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 3. Shops table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS shops (
        id SERIAL PRIMARY KEY,
        shop_id VARCHAR(20) UNIQUE NOT NULL,
        shop_name VARCHAR(100) NOT NULL,
        owner_mobile VARCHAR(15) NOT NULL,
        nic_number VARCHAR(20),
        qr_slug VARCHAR(50) UNIQUE NOT NULL,
        rep_id INTEGER REFERENCES users(id),
        created_by_rep_id INTEGER REFERENCES users(id),
        qr_identifier VARCHAR(100) UNIQUE,
        province VARCHAR(100),
        region VARCHAR(100),
        area VARCHAR(100),
        br_number VARCHAR(100),
        address TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Ensure all users columns exist
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50) UNIQUE`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS province VARCHAR(100)`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS region VARCHAR(100)`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS area VARCHAR(100)`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}'`);

    // Ensure all campaigns columns exist
    await pool.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS objective VARCHAR(50)`);
    await pool.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS target_audience VARCHAR(50)`);
    await pool.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS voucher_value VARCHAR(50)`);
    await pool.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS voucher_limit INTEGER`);
    await pool.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS budget NUMERIC(10,2)`);
    await pool.query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS banner_url VARCHAR(255)`);

    // Ensure all shops columns exist (for migration)
    await pool.query(`ALTER TABLE shops ADD COLUMN IF NOT EXISTS br_number VARCHAR(100)`);
    await pool.query(`ALTER TABLE shops ADD COLUMN IF NOT EXISTS address TEXT`);
    await pool.query(`ALTER TABLE shops ADD COLUMN IF NOT EXISTS province VARCHAR(100)`);
    await pool.query(`ALTER TABLE shops ADD COLUMN IF NOT EXISTS region VARCHAR(100)`);
    await pool.query(`ALTER TABLE shops ADD COLUMN IF NOT EXISTS area VARCHAR(100)`);

    // 4. Vouchers table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vouchers (
        id SERIAL PRIMARY KEY,
        claim_id VARCHAR(30) UNIQUE NOT NULL,
        campaign_id VARCHAR(20) NOT NULL REFERENCES campaigns(campaign_id) ON DELETE CASCADE,
        ad_id VARCHAR(20) NOT NULL,
        platform VARCHAR(20),
        customer_mobile VARCHAR(15) NOT NULL,
        voucher_code VARCHAR(20) NOT NULL,
        claim_status VARCHAR(20) DEFAULT 'claimed' CHECK (claim_status IN ('claimed', 'redeemed', 'expired', 'disabled')),
        expiry_status VARCHAR(20) DEFAULT 'active' CHECK (expiry_status IN ('active', 'expired')),
        sms_sent BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Ensure all vouchers columns exist
    await pool.query(`ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS platform VARCHAR(20)`);
    await pool.query(`ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS sms_sent BOOLEAN DEFAULT FALSE`);

    // 5. Redemptions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS redemptions (
        id SERIAL PRIMARY KEY,
        redemption_id VARCHAR(30) UNIQUE NOT NULL,
        claim_id VARCHAR(30) NOT NULL REFERENCES vouchers(claim_id) ON DELETE CASCADE,
        shop_id VARCHAR(20) NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
        otp_code VARCHAR(10) NOT NULL,
        otp_status VARCHAR(20) DEFAULT 'pending',
        final_status VARCHAR(20) DEFAULT 'pending',
        otp_expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '5 minutes'),
        otp_attempts INTEGER DEFAULT 0,
        redeemed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 6. Activity Logs table
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

    /* =========================================================
       PHASE 3 — SEED DEFAULT ADMIN
       ========================================================= */
    const existingAdmin = await pool.query("SELECT id FROM users WHERE role = 'admin'");
    if (existingAdmin.rows.length === 0) {
      const passwordHash = await bcrypt.hash('password', 10);
      await pool.query(
        "INSERT INTO users (username, password_hash, role, employee_id) VALUES ($1, $2, $3, $4)",
        ['sysadmin', passwordHash, 'admin', 'SYS-000001']
      );
      console.log('Created default admin user: sysadmin / password  (change this immediately!)');
    }
    console.log('✓ Database schema up to date');
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