const pool = require('./config/db');

async function addCampaignsTable() {
  try {
    console.log('🔄 Adding campaigns table to existing database...');

    // Create campaigns table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS campaigns (
          id SERIAL PRIMARY KEY,
          campaign_id VARCHAR(20) UNIQUE NOT NULL,
          campaign_name VARCHAR(100) NOT NULL,
          description TEXT,
          start_date TIMESTAMP NOT NULL,
          end_date TIMESTAMP NOT NULL,
          status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('draft', 'active', 'expired', 'disabled')),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Add campaign_id column to vouchers table if it doesn't exist
    await pool.query(`
      ALTER TABLE vouchers
      ADD COLUMN IF NOT EXISTS campaign_id VARCHAR(20),
      ADD COLUMN IF NOT EXISTS expiry_status VARCHAR(20) DEFAULT 'active' CHECK (expiry_status IN ('active', 'expired'));
    `);

    // Add foreign key constraint (only if it doesn't exist)
    try {
      await pool.query(`
        ALTER TABLE vouchers
        ADD CONSTRAINT fk_vouchers_campaign
        FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) ON DELETE CASCADE;
      `);
    } catch (error) {
      // Constraint might already exist, ignore
      console.log('Foreign key constraint already exists or could not be added');
    }

    console.log('✅ Campaigns table and voucher updates completed successfully!');
    console.log('🎉 Campaign expiry system is now ready!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

addCampaignsTable();