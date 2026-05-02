const pool = require('./config/db');

async function runSprint3Migrations() {
  try {
    console.log('Running Sprint 3 migrations...');

    // 1. Add platform to vouchers
    try {
      await pool.query('ALTER TABLE vouchers ADD COLUMN platform VARCHAR(20);');
      console.log('✅ Added platform column to vouchers table.');
    } catch (err) {
      if (err.code === '42701') console.log('⚠️ Column platform already exists on vouchers.');
      else throw err;
    }

    // 2. Add location columns to users
    try {
      await pool.query('ALTER TABLE users ADD COLUMN province VARCHAR(50), ADD COLUMN region VARCHAR(50), ADD COLUMN area VARCHAR(50);');
      console.log('✅ Added province, region, area columns to users table.');
    } catch (err) {
      if (err.code === '42701') console.log('⚠️ Location columns already exist on users.');
      else throw err;
    }

    // 3. Add location columns to shops
    try {
      await pool.query('ALTER TABLE shops ADD COLUMN province VARCHAR(50), ADD COLUMN region VARCHAR(50), ADD COLUMN area VARCHAR(50);');
      console.log('✅ Added province, region, area columns to shops table.');
    } catch (err) {
      if (err.code === '42701') console.log('⚠️ Location columns already exist on shops.');
      else throw err;
    }

    console.log('✅ Sprint 3 migrations completed successfully.');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    pool.end();
  }
}

runSprint3Migrations();
