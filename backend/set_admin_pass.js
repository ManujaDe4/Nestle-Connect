const pool = require('./config/db');
const bcrypt = require('bcrypt');

async function updateAdminPassword() {
  try {
    const hashedPassword = await bcrypt.hash('123', 10);
    const result = await pool.query(
      "UPDATE users SET password_hash = $1 WHERE username = 'sysadmin' OR role = 'admin'",
      [hashedPassword]
    );
    if (result.rowCount > 0) {
      console.log('✅ Password for sysadmin updated to: 123');
    } else {
      console.log('❌ Could not find sysadmin user to update.');
    }
    process.exit(0);
  } catch (err) {
    console.error('Error updating password:', err);
    process.exit(1);
  }
}

updateAdminPassword();
