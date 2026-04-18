const pool = require('./backend/config/db');
(async () => {
  try {
    await pool.query('ALTER TABLE users ADD COLUMN employee_id VARCHAR(50) UNIQUE;');
    console.log('Column employee_id added to users table');
  } catch (err) {
    if (err.code === '42701') {
      console.log('Column already exists, moving on.');
    } else {
      console.error(err);
    }
  } finally {
    pool.end();
  }
})();
