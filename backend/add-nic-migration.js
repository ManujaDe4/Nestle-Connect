const pool = require('./config/db');

async function runMigration() {
  try {
    console.log('🔄 Adding nic_number to shops table...');
    await pool.query('ALTER TABLE shops ADD COLUMN nic_number VARCHAR(20)');
    console.log('✅ nic_number added successfully!');
    process.exit(0);
  } catch (error) {
    if (error.code === '42701') {
      console.log('✅ column "nic_number" of relation "shops" already exists.');
      process.exit(0);
    }
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();
