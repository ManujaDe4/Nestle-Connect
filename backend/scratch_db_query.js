require('dotenv').config();
const pool = require('./config/db');

async function test() {
  const res = await pool.query("SELECT id, username, role FROM users");
  console.log(res.rows);
  pool.end();
}
test();
