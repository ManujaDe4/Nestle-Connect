const pool = require('./config/db');

async function fixRedemptionsTable() {
  try {
    console.log('Adding missing columns to redemptions table...');
    await pool.query(`
      ALTER TABLE redemptions 
      ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '5 minutes'),
      ADD COLUMN IF NOT EXISTS otp_attempts INTEGER DEFAULT 0
    `);
    console.log('✅ Successfully added missing columns to redemptions table.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing redemptions table:', error);
    process.exit(1);
  }
}

fixRedemptionsTable();
