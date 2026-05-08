require('dotenv').config();
const pool = require('./config/db');

async function fixUser() {
  try {
    await pool.query("UPDATE users SET province='Western', region='Colombo', area='Colombo 01' WHERE username='manu'");
    console.log('Fixed manu user to include province');
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
fixUser();
