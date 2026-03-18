const pool = require("../config/db");

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

module.exports = { getShopBySlug };