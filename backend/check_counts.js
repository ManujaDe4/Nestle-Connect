const pool = require('./config/db');

async function checkCounts() {
  try {
    const reps = await pool.query("SELECT COUNT(*) FROM users WHERE role = 'rep'");
    const shops = await pool.query("SELECT COUNT(*) FROM shops");
    const logs = await pool.query("SELECT COUNT(*) FROM activity_logs");
    const redemptions = await pool.query("SELECT COUNT(*) FROM redemptions");

    console.log(`Reps: ${reps.rows[0].count}`);
    console.log(`Shops: ${shops.rows[0].count}`);
    console.log(`Logs: ${logs.rows[0].count}`);
    console.log(`Redemptions: ${redemptions.rows[0].count}`);
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

checkCounts();
