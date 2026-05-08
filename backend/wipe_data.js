const pool = require('./config/db');

async function wipeData() {
  try {
    await pool.query('DELETE FROM activity_logs;');
    console.log('✅ All activity logs deleted.');

    await pool.query('DELETE FROM shops;');
    console.log('✅ All shops deleted.');

    await pool.query("DELETE FROM users WHERE role = 'sales_distributor';");
    console.log('✅ All sales distributors deleted.');

    console.log('Database wipe complete.');
    process.exit(0);
  } catch (error) {
    console.error('Error wiping database:', error);
    process.exit(1);
  }
}

wipeData();
