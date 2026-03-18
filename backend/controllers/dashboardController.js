const pool = require("../config/db");

const getDashboardSummary = async (req, res) => {
  try {
    const totalClaimsResult = await pool.query("SELECT COUNT(*) FROM vouchers");
    const totalRedemptionsResult = await pool.query(
      "SELECT COUNT(*) FROM redemptions WHERE final_status = 'redeemed'"
    );

    const latestSaleResult = await pool.query(`
      SELECT r.redemption_id, r.redeemed_at, s.shop_name, v.campaign_id, v.ad_id, v.voucher_code
      FROM redemptions r
      JOIN shops s ON r.shop_id = s.shop_id
      JOIN vouchers v ON r.claim_id = v.claim_id
      WHERE r.final_status = 'redeemed'
      ORDER BY r.redeemed_at DESC
      LIMIT 1
    `);

    const bestCampaignResult = await pool.query(`
      SELECT campaign_id, ad_id, COUNT(*) AS total_sales
      FROM vouchers v
      JOIN redemptions r ON v.claim_id = r.claim_id
      WHERE r.final_status = 'redeemed'
      GROUP BY campaign_id, ad_id
      ORDER BY total_sales DESC
      LIMIT 1
    `);

    const totalClaims = parseInt(totalClaimsResult.rows[0].count, 10);
    const totalConfirmedSales = parseInt(totalRedemptionsResult.rows[0].count, 10);
    const redemptionRate =
      totalClaims > 0 ? ((totalConfirmedSales / totalClaims) * 100).toFixed(1) : "0.0";

    res.status(200).json({
      totalClaims,
      totalConfirmedSales,
      redemptionRate: `${redemptionRate}%`,
      latestConfirmedSale: latestSaleResult.rows[0] || null,
      bestCampaign: bestCampaignResult.rows[0] || null,
    });
  } catch (error) {
    console.error("getDashboardSummary error:", error);
    res.status(500).json({ message: "Server error while fetching dashboard" });
  }
};

module.exports = { getDashboardSummary };