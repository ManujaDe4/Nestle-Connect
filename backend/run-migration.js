const fs = require('fs');
const pool = require('./config/db');

async function runMigrations() {
  try {
    console.log('🔄 Running database migrations...');

    // Read the schema.sql file
    const schemaSQL = fs.readFileSync('../database/schema.sql', 'utf8');

    // Execute the entire schema
    console.log('📝 Executing schema...');
    await pool.query(schemaSQL);

    console.log('✅ Database migrations completed successfully!');
    console.log('🎉 Campaigns table created and voucher table updated!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigrations();