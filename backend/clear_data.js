const pool = require('./config/db');

async function clearData() {
  const client = await pool.connect();
  try {
    console.log('Starting data cleanup...');
    await client.query('BEGIN');

    // 1. Clear redemptions first (depends on shops and vouchers)
    console.log('Clearing redemptions...');
    await client.query('DELETE FROM redemptions');

    // 2. Clear activity logs (depends on users and shops)
    console.log('Clearing activity logs...');
    await client.query('DELETE FROM activity_logs');

    // 3. Clear shops (depends on users)
    console.log('Clearing shops...');
    await client.query('DELETE FROM shops');

    // 4. Clear reps (all users with role 'rep')
    console.log('Clearing sales representatives...');
    await client.query("DELETE FROM users WHERE role = 'rep'");

    await client.query('COMMIT');
    console.log('✅ Successfully cleared all reps and shops.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error clearing data:', error);
  } finally {
    client.release();
    process.exit();
  }
}

clearData();
