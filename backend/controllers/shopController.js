const pool = require("../config/db");
const QRCode = require("qrcode");
const { logActivity } = require("../controllers/activityController");
const sendSMS = require("../services/sms");
const { getLocationPrefix } = require('../utils/locationCodes');

/**
 * Build the WHERE clause that scopes a shops query to a Sales Distributor's
 * assigned area. SDs only see shops in their own province + region + area,
 * regardless of who registered them. Admins see everything.
 */
function buildAreaScope(user) {
  if (user.role !== 'sales_distributor') return { whereSql: '', params: [] };

  const conditions = [];
  const params = [];
  if (user.province) { params.push(user.province); conditions.push(`province = $${params.length}`); }
  if (user.region)   { params.push(user.region);   conditions.push(`region = $${params.length}`); }
  if (user.area)     { params.push(user.area);     conditions.push(`area = $${params.length}`); }

  if (conditions.length === 0) return { whereSql: ' WHERE FALSE', params: [] };
  return { whereSql: ' WHERE ' + conditions.join(' AND '), params };
}

const getShopBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const result = await pool.query("SELECT * FROM shops WHERE qr_slug = $1", [slug]);
    if (result.rows.length === 0) return res.status(404).json({ message: "Shop not found" });
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("getShopBySlug error:", error);
    res.status(500).json({ message: "Server error while fetching shop" });
  }
};

const getAllShops = async (req, res) => {
  try {
    const { whereSql, params } = buildAreaScope(req.user);
    const query = `SELECT * FROM shops${whereSql} ORDER BY created_at DESC`;
    const result = await pool.query(query, params);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("getAllShops error:", error);
    res.status(500).json({ message: "Server error while fetching shops" });
  }
};

const createShop = async (req, res) => {
  try {
    const { shop_name, owner_mobile, nic_number, province, region, area, br_number, address } = req.body;
    if (!shop_name || !owner_mobile || !nic_number) {
      return res.status(400).json({ message: "Shop name, owner mobile, and NIC number are required" });
    }

    const locPrefix = getLocationPrefix(province, region);
    const shopPrefix = `SHP-${locPrefix}-`;
    const lastShop = await pool.query("SELECT shop_id FROM shops WHERE shop_id LIKE $1 ORDER BY shop_id DESC LIMIT 1", [`${shopPrefix}%`]);
    let nextNum = 1;
    if (lastShop.rows.length > 0) {
      const lastId = lastShop.rows[0].shop_id;
      const numPart = lastId.replace(shopPrefix, '');
      nextNum = parseInt(numPart, 10) + 1;
    }
    const shop_id = `${shopPrefix}${String(nextNum).padStart(6, '0')}`;

    const qr_slug = shop_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    let uniqueSlug = qr_slug;
    let counter = 1;
    while (true) {
      const slugCheck = await pool.query("SELECT id FROM shops WHERE qr_slug = $1", [uniqueSlug]);
      if (slugCheck.rows.length === 0) break;
      uniqueSlug = `${qr_slug}-${counter}`;
      counter++;
    }

    const createdByRepId = req.user.role === 'sales_distributor' ? req.user.id : null;
    const repId = req.user.role === 'sales_distributor' ? req.user.id : null;

    const insertResult = await pool.query(
      "INSERT INTO shops (shop_id, shop_name, owner_mobile, nic_number, qr_slug, rep_id, created_by_rep_id, province, region, area, br_number, address) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id",
      [shop_id, shop_name, owner_mobile, nic_number, uniqueSlug, repId, createdByRepId, province || null, region || null, area || null, br_number || null, address || null]
    );

    const shopRowId = insertResult.rows[0].id;
    await logActivity({
      userId: req.user.id, shopId: shopRowId, action: 'shop_registered',
      detail: `Registered shop ${shop_id} (${shop_name}) with owner ${owner_mobile} (NIC: ${nic_number})`
    });

    const message = `Welcome to Nestle Connect! Your shop ${shop_name} (ID: ${shop_id}) has been successfully verified from Nestle.`;
    sendSMS(owner_mobile, message, "shop_registration", shopRowId).catch(err => {
      console.error("Failed to send welcome SMS to shop owner:", err);
    });

    // Build QR URL from PUBLIC_BASE_URL so locally-generated QRs work locally.
    const baseUrl = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
    const shopUrl = `${baseUrl.replace(/\/$/, '')}/store-verify.html?shop=${uniqueSlug}`;
    const qrCodeDataURL = await QRCode.toDataURL(shopUrl, { width: 300, margin: 2 });

    res.status(201).json({
      message: "Shop registered successfully",
      shop: { shop_id, shop_name, owner_mobile, nic_number, br_number, address, qr_slug: uniqueSlug },
      qrCode: qrCodeDataURL
    });
  } catch (error) {
    console.error("createShop error:", error);
    res.status(500).json({ message: "Server error while registering shop" });
  }
};

const deleteShop = async (req, res) => {
  const { id } = req.params;
  try {
    if (req.user.role === 'sales_distributor') {
      const ownership = await pool.query('SELECT created_by_rep_id FROM shops WHERE id = $1', [id]);
      if (ownership.rows.length === 0) return res.status(404).json({ message: 'Shop not found' });
      if (ownership.rows[0].created_by_rep_id !== req.user.id) {
        return res.status(403).json({ message: 'You can only delete shops you registered.' });
      }
    }
    await pool.query('DELETE FROM activity_logs WHERE shop_id = $1', [id]);
    const result = await pool.query('DELETE FROM shops WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ message: 'Shop not found' });
    res.status(200).json({ message: 'Shop deleted successfully' });
  } catch (error) {
    console.error('deleteShop error:', error);
    res.status(500).json({ message: 'Server error while deleting shop' });
  }
};

const mapQRCode = async (req, res) => {
  try {
    const { shop_id, qr_identifier } = req.body;
    if (!shop_id || !qr_identifier) return res.status(400).json({ message: "shop_id and qr_identifier are required" });

    const qrCheck = await pool.query("SELECT id, shop_name FROM shops WHERE qr_identifier = $1", [qr_identifier]);
    if (qrCheck.rows.length > 0) {
      return res.status(400).json({ message: `QR code is already linked to: ${qrCheck.rows[0].shop_name}` });
    }
    const shopResult = await pool.query("SELECT id, shop_name FROM shops WHERE id = $1", [shop_id]);
    if (shopResult.rows.length === 0) return res.status(404).json({ message: "Shop not found" });

    await pool.query("UPDATE shops SET qr_identifier = $1 WHERE id = $2", [qr_identifier, shop_id]);
    await logActivity({
      userId: req.user.id, shopId: shopResult.rows[0].id, action: 'qr_linked',
      detail: `Linked QR ${qr_identifier} to shop ${shopResult.rows[0].shop_name}`
    });
    res.status(200).json({ message: "QR Code Successfully Linked", shop: shopResult.rows[0], qr_identifier });
  } catch (error) {
    console.error("mapQRCode error:", error);
    res.status(500).json({ message: "Server error while mapping QR code" });
  }
};

const getRegistrationLog = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.id, s.shop_id, s.shop_name, s.owner_mobile, s.nic_number, s.qr_slug,
             s.qr_identifier, s.created_at, u.username AS rep_name, u.id AS rep_id
        FROM shops s
        LEFT JOIN users u ON s.created_by_rep_id = u.id
       ORDER BY s.created_at DESC
    `);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("getRegistrationLog error:", error);
    res.status(500).json({ message: "Server error while fetching registration log" });
  }
};

const exportShopsCSV = async (req, res) => {
  try {
    const { whereSql, params } = buildAreaScope(req.user);
    const query = `SELECT * FROM shops${whereSql} ORDER BY created_at DESC`;
    const result = await pool.query(query, params);
    const shops = result.rows;

    const now = new Date();
    const reportDate = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
    const reportTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const q = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB') : 'N/A';

    const scopeLine = req.user.role === 'sales_distributor'
      ? `Area: ${[req.user.province, req.user.region, req.user.area].filter(Boolean).join(' > ') || 'Unassigned'}`
      : 'All Areas';

    let csv = '';
    csv += `"NESTLE CONNECT"\r\n`;
    csv += `"Sales Distributor - Area Shop Portfolio Report"\r\n`;
    csv += `"Confidential - For Internal Use Only"\r\n`;
    csv += `"Generated On:","${reportDate} at ${reportTime}"\r\n`;
    csv += `"Scope:","${scopeLine}"\r\n`;
    csv += `"Total Shops:","${shops.length}"\r\n`;
    csv += `\r\n`;

    csv += ["Shop ID","Shop Name","Owner Mobile","NIC Number","BR Number","Address","Province","Region","Area","QR Identifier","QR Slug","QR Linked","Registered Date"].map(q).join(',') + '\r\n';

    shops.forEach(s => {
      csv += [
        s.shop_id, s.shop_name || '', s.owner_mobile || '', s.nic_number || '',
        s.br_number || '', s.address || '',
        s.province || '', s.region || '', s.area || '',
        s.qr_identifier || '', s.qr_slug || '',
        s.qr_identifier ? 'Yes' : 'No',
        fmtDate(s.created_at)
      ].map(q).join(',') + '\r\n';
    });

    csv += `\r\n"=== END OF REPORT ==="\r\n`;
    csv += `"This report is auto-generated by Nestle Connect."\r\n`;

    const fileTs = now.toISOString().slice(0, 10);
    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.header('Content-Disposition', `attachment; filename="Nestle_Connect_Area_Shops_${fileTs}.csv"`);
    return res.send('﻿' + csv);
  } catch (error) {
    console.error('exportShopsCSV error:', error);
    res.status(500).json({ message: 'Server error while exporting shops' });
  }
};

module.exports = { getShopBySlug, getAllShops, createShop, deleteShop, mapQRCode, getRegistrationLog, exportShopsCSV };
