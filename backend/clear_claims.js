const pool = require('./config/db');

async function clearClaims() {
  const client = await pool.connect();
  try {
    console.log('Clearing all claims (vouchers) and redemptions...');
    await client.query('BEGIN');

    // 1. Clear redemptions (reference vouchers)
    await client.query('DELETE FROM redemptions');
    console.log('✅ All redemptions cleared.');

    // 2. Clear vouchers (claims)
    await client.query('DELETE FROM vouchers');
    console.log('✅ All claims (vouchers) cleared.');

    await client.query('COMMIT');
    console.log('✓ Successfully cleared all current claims.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error clearing claims:', error);
  } finally {
    client.release();
    process.exit();
  }
}

clearClaims();
