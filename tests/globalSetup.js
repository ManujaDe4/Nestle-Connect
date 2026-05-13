/**
 * Playwright Global Setup
 * Runs ONCE before all test suites.
 *
 * Responsibilities:
 *  1. Reset the sysadmin password to "password" so TC_01 always passes.
 *  2. Remove accumulated stale "Test Shop PW" entries left by previous TC_14
 *     runs so the slug-uniqueness loop stays O(1) and the createShop API
 *     responds quickly (prevents the 15-s hang seen when running in parallel).
 *
 * NOTE: dotenv / pg / bcrypt live in backend/node_modules, so we resolve them
 * from there explicitly rather than from the root node_modules.
 */

const path   = require('path');
const BACKEND = path.join(__dirname, '..', 'backend');

// Resolve packages from backend's own node_modules
const dotenv = require(path.join(BACKEND, 'node_modules', 'dotenv'));
const { Pool } = require(path.join(BACKEND, 'node_modules', 'pg'));
const bcrypt = require(path.join(BACKEND, 'node_modules', 'bcrypt'));

// Load backend environment variables
dotenv.config({ path: path.join(BACKEND, '.env') });

module.exports = async function globalSetup() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    /* ── 1. Reset admin password to "password" ──────────────────────────── */
    const hash = await bcrypt.hash('password', 10);
    const r = await pool.query(
      "UPDATE users SET password_hash = $1 WHERE employee_id = 'SYS-000001' RETURNING employee_id",
      [hash]
    );
    if (r.rowCount > 0) {
      console.log('\n[globalSetup] ✓ Admin (SYS-000001) password reset to "password"');
    } else {
      console.warn('\n[globalSetup] ⚠ Admin SYS-000001 not found in DB — TC_01 may fail');
    }

    /* ── 2. Clean up stale TC_14 test shops ──────────────────────────────── */
    // Must delete child activity_logs first (FK: activity_logs.shop_id → shops.id)
    await pool.query(`
      DELETE FROM activity_logs
      WHERE shop_id IN (
        SELECT id FROM shops WHERE shop_name LIKE 'Test Shop PW%'
      )
    `);
    const del = await pool.query(
      "DELETE FROM shops WHERE shop_name LIKE 'Test Shop PW%'"
    );
    if (del.rowCount > 0) {
      console.log(`[globalSetup] ✓ Removed ${del.rowCount} stale "Test Shop PW*" shop(s)\n`);
    }

  } finally {
    await pool.end();
  }
};
