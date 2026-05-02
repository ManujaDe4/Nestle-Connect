const pool = require("../config/db");
const QRCode = require("qrcode");
const { logActivity } = require("../controllers/activityController");
const sendSMS = require("../services/sms");
const { getLocationPrefix } = require('../utils/locationCodes');

const getShopBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const result = await pool.query(
      "SELECT * FROM shops WHERE qr_slug = $1",
      [slug]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Shop not found" });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("getShopBySlug error:", error);
    res.status(500).json({ message: "Server error while fetching shop" });
  }
};

const getAllShops = async (req, res) => {
  try {
    let query = "SELECT * FROM shops";
    let params = [];
    if (req.user.role === 'rep') {
      query += " WHERE rep_id = $1";
      params = [req.user.id];
    }
    query += " ORDER BY created_at DESC";
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

    // Generate shop_id using SHP-[PROV]-[REG]-000001 format
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

    // Generate qr_slug
    const qr_slug = shop_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    // Check if qr_slug exists, if so append number
    let uniqueSlug = qr_slug;
    let counter = 1;
    while (true) {
      const slugCheck = await pool.query("SELECT id FROM shops WHERE qr_slug = $1", [uniqueSlug]);
      if (slugCheck.rows.length === 0) break;
      uniqueSlug = `${qr_slug}-${counter}`;
      counter++;
    }

    // Track which rep created this shop
    const createdByRepId = req.user.role === 'rep' ? req.user.id : null;
    const repId = req.user.role === 'rep' ? req.user.id : null;

    const insertResult = await pool.query(
      "INSERT INTO shops (shop_id, shop_name, owner_mobile, nic_number, qr_slug, rep_id, created_by_rep_id, province, region, area, br_number, address) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id",
      [shop_id, shop_name, owner_mobile, nic_number, uniqueSlug, repId, createdByRepId, province || null, region || null, area || null, br_number || null, address || null]
    );

    const shopRowId = insertResult.rows[0].id;
    await logActivity({
      userId: req.user.id,
      shopId: shopRowId,
      action: 'shop_registered',
      detail: `Registered shop ${shop_id} (${shop_name}) with owner ${owner_mobile} (NIC: ${nic_number})`
    });

    // Send SMS to the shop owner
    const message = `Welcome to Nestle Connect! Your shop ${shop_name} (ID: ${shop_id}) has been successfully verified from Nestle.`;
    // Try to send SMS async and log errors if it fails, without crashing the request
    sendSMS(owner_mobile, message, "shop_registration", shopRowId).catch(err => {
      console.error("Failed to send welcome SMS to shop owner:", err);
    });

    // Generate QR
    const shopUrl = `https://nestle-connect.onrender.com/store-verify.html?shop=${uniqueSlug}`;
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
    // Delete associated activity logs first to avoid foreign key constraint violation
    await pool.query('DELETE FROM activity_logs WHERE shop_id = $1', [id]);
    
    const result = await pool.query('DELETE FROM shops WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Shop not found' });
    }
    res.status(200).json({ message: 'Shop deleted successfully' });
  } catch (error) {
    console.error('deleteShop error:', error);
    res.status(500).json({ message: 'Server error while deleting shop' });
  }
};

const mapQRCode = async (req, res) => {
  try {
    const { shop_id, qr_identifier } = req.body;

    if (!shop_id || !qr_identifier) {
      return res.status(400).json({ message: "shop_id and qr_identifier are required" });
    }

    // Check if qr_identifier already exists
    const qrCheck = await pool.query(
      "SELECT id, shop_name FROM shops WHERE qr_identifier = $1",
      [qr_identifier]
    );

    if (qrCheck.rows.length > 0) {
      return res.status(400).json({
        message: `QR code is already linked to: ${qrCheck.rows[0].shop_name}`
      });
    }

    // Get shop info
    const shopResult = await pool.query(
      "SELECT id, shop_name FROM shops WHERE id = $1",
      [shop_id]
    );

    if (shopResult.rows.length === 0) {
      return res.status(404).json({ message: "Shop not found" });
    }

    // Update shop with qr_identifier
    await pool.query(
      "UPDATE shops SET qr_identifier = $1 WHERE id = $2",
      [qr_identifier, shop_id]
    );

    await logActivity({
      userId: req.user.id,
      shopId: shopResult.rows[0].id,
      action: 'qr_linked',
      detail: `Linked QR ${qr_identifier} to shop ${shopResult.rows[0].shop_name}`
    });

    res.status(200).json({
      message: "QR Code Successfully Linked",
      shop: shopResult.rows[0],
      qr_identifier
    });
  } catch (error) {
    console.error("mapQRCode error:", error);
    res.status(500).json({ message: "Server error while mapping QR code" });
  }
};

const getRegistrationLog = async (req, res) => {
  try {
    // Get all shops with their rep creator details
    const result = await pool.query(`
      SELECT 
        s.id,
        s.shop_id,
        s.shop_name,
        s.owner_mobile,
        s.nic_number,
        s.qr_slug,
        s.qr_identifier,
        s.created_at,
        u.username as rep_name,
        u.id as rep_id
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
    let query = "SELECT * FROM shops";
    let params = [];
    if (req.user.role === 'rep') {
      query += " WHERE rep_id = $1";
      params = [req.user.id];
    }
    query += " ORDER BY created_at DESC";
    const result = await pool.query(query, params);
    const shops = result.rows;

    const now = new Date();
    const reportDate = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
    const reportTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB') : 'N/A';

    let csv = '';

    // Header
    csv += `"NESTLÉ CONNECT"\r\n`;
    csv += `"Sales Representative — Shop Portfolio Report"\r\n`;
    csv += `"Confidential — For Internal Use Only"\r\n`;
    csv += `"Generated On:","${reportDate} at ${reportTime}"\r\n`;
    csv += `"Total Shops:","${shops.length}"\r\n`;
    csv += `\r\n`;

    // Data table
    csv += ["Shop ID", "Shop Name", "Owner Mobile", "NIC Number", "BR Number", "Address",
            "Province", "Region", "Area", "QR Identifier", "QR Slug", "QR Linked", "Registered Date"
    ].map(q).join(',') + '\r\n';

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

    csv += `\r\n"━━━ END OF REPORT ━━━"\r\n`;
    csv += `"This report is auto-generated by Nestlé Connect."\r\n`;

    const fileTs = now.toISOString().slice(0, 10);
    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.header('Content-Disposition', `attachment; filename="Nestle_Connect_My_Shops_${fileTs}.csv"`);
    return res.send('\uFEFF' + csv);
  } catch (error) {
    console.error('exportShopsCSV error:', error);
    res.status(500).json({ message: 'Server error while exporting shops' });
  }
};

module.exports = { getShopBySlug, getAllShops, createShop, deleteShop, mapQRCode, getRegistrationLog, exportShopsCSV };