require('dotenv').config();
const pool = require('./config/db');

async function test() {
  const res = await pool.query("SELECT province, region, area FROM users WHERE username='manu'");
  console.log(res.rows[0]);
  pool.end();
}
test();
