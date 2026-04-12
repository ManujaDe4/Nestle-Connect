const pool = require("../config/db");
const QRCode = require("qrcode");

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
    const result = await pool.query("SELECT * FROM shops ORDER BY created_at DESC");
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("getAllShops error:", error);
    res.status(500).json({ message: "Server error while fetching shops" });
  }
};

const createShop = async (req, res) => {
  try {
    const { shop_name, owner_mobile } = req.body;

    if (!shop_name || !owner_mobile) {
      return res.status(400).json({ message: "Shop name and owner mobile are required" });
    }

    // Generate shop_id
    const result = await pool.query("SELECT MAX(CAST(SUBSTRING(shop_id FROM 5) AS INTEGER)) as max_id FROM shops");
    const maxId = result.rows[0].max_id || 0;
    const newId = maxId + 1;
    const shop_id = `SHOP${String(newId).padStart(3, '0')}`;

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

    // Insert
    await pool.query(
      "INSERT INTO shops (shop_id, shop_name, owner_mobile, qr_slug) VALUES ($1, $2, $3, $4)",
      [shop_id, shop_name, owner_mobile, uniqueSlug]
    );

    // Generate QR
    const shopUrl = `https://nestle-connect.onrender.com/store-verify.html?shop=${uniqueSlug}`;
    const qrCodeDataURL = await QRCode.toDataURL(shopUrl, { width: 300, margin: 2 });

    res.status(201).json({
      message: "Shop registered successfully",
      shop: { shop_id, shop_name, owner_mobile, qr_slug: uniqueSlug },
      qrCode: qrCodeDataURL
    });
  } catch (error) {
    console.error("createShop error:", error);
    res.status(500).json({ message: "Server error while registering shop" });
  }
};

module.exports = { getShopBySlug, getAllShops, createShop };