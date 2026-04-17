const pool = require('./config/db');

async function createActiveCampaign() {
  try {
    await pool.query(`
      INSERT INTO campaigns (campaign_id, campaign_name, description, start_date, end_date, status)
      VALUES ('CMP001', 'Active Test Campaign', 'Test campaign for claiming vouchers', NOW(), NOW() + INTERVAL '30 days', 'active')
    `);
    console.log('✅ Active campaign CMP001 created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating campaign:', error.message);
    process.exit(1);
  }
}

createActiveCampaign();