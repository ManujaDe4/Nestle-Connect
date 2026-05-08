require('dotenv').config();
const pool = require('./config/db');

async function fixUser() {
  try {
    const res = await pool.query("SELECT id FROM users WHERE username='manu'");
    const manuId = res.rows[0].id;

    // Check if manu already has a shop
    const shopRes = await pool.query("SELECT id FROM shops WHERE rep_id=$1", [manuId]);
    if (shopRes.rows.length === 0) {
      await pool.query(`
        INSERT INTO shops (shop_id, shop_name, owner_mobile, nic_number, qr_slug, rep_id, province, region, area, address)
        VALUES ('SHOP_MANU_1', 'Manu Test Shop', '0771112223', '199012345678', 'manu-test-shop', $1, 'Western', 'Colombo', 'Colombo 01', '123 Main St')
      `, [manuId]);
      console.log('Added a shop for manu');
    } else {
      console.log('Manu already has a shop');
    }
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
fixUser();
