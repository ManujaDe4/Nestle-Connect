/**
 * One-off script: delete every user except the system admin (role = 'admin').
 * Run from the backend/ directory:  node scripts/clear-non-admin-users.js
 */
require('dotenv').config();
const pool = require('../config/db');

(async () => {
  try {
    // 1. Find non-admin users
    const { rows: targets } = await pool.query(
      "SELECT id, username, role FROM users WHERE role != 'admin'"
    );

    if (targets.length === 0) {
      console.log('Nothing to delete — only admin users exist.');
      process.exit(0);
    }

    console.log(`Deleting ${targets.length} user(s):`);
    targets.forEach(u => console.log(`  - [${u.role}] ${u.username} (id ${u.id})`));

    const ids = targets.map(u => u.id);

    // 2. Remove activity logs tied to these users
    const logs = await pool.query(
      'DELETE FROM activity_logs WHERE user_id = ANY($1)',
      [ids]
    );
    console.log(`  Removed ${logs.rowCount} activity log row(s)`);

    // 3. Nullify shop FK references
    const shops = await pool.query(
      'UPDATE shops SET rep_id = NULL, created_by_rep_id = NULL WHERE rep_id = ANY($1) OR created_by_rep_id = ANY($1)',
      [ids]
    );
    console.log(`  Updated ${shops.rowCount} shop row(s)`);

    // 4. Delete the users
    const del = await pool.query(
      "DELETE FROM users WHERE role != 'admin'"
    );
    console.log(`✓ Deleted ${del.rowCount} user(s). Admin account preserved.`);

    // 5. Show remaining users
    const { rows: remaining } = await pool.query(
      'SELECT id, username, employee_id, role FROM users'
    );
    console.log('\nRemaining users:');
    remaining.forEach(u => console.log(`  [${u.role}] ${u.username} (${u.employee_id || 'no emp id'})`));

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
