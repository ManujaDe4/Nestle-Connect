const pool = require("../config/db");

const getDashboardSummary = async (req, res) => {
  try {
    const totalClaimsResult = await pool.query(
      "SELECT COUNT(*) AS count FROM vouchers"
    );

    const totalConfirmedSalesResult = await pool.query(
      "SELECT COUNT(*) AS count FROM redemptions WHERE final_status = 'redeemed'"
    );

    const latestConfirmedSaleResult = await pool.query(`
      SELECT 
        r.redemption_id,
        r.redeemed_at,
        v.voucher_code
      FROM redemptions r
      JOIN vouchers v ON r.claim_id = v.claim_id
      WHERE r.final_status = 'redeemed'
      ORDER BY r.redeemed_at DESC
      LIMIT 1
    `);

    const bestCampaignResult = await pool.query(`
      SELECT campaign_id, COUNT(*) AS redemption_count
      FROM vouchers
      WHERE claim_status = 'redeemed'
      GROUP BY campaign_id
      ORDER BY redemption_count DESC
      LIMIT 1
    `);

    const totalClaims = parseInt(totalClaimsResult.rows[0].count, 10) || 0;
    const totalConfirmedSales =
      parseInt(totalConfirmedSalesResult.rows[0].count, 10) || 0;

    const redemptionRate =
      totalClaims > 0
        ? ((totalConfirmedSales / totalClaims) * 100).toFixed(1) + "%"
        : "0.0%";

    const latestConfirmedSale =
      latestConfirmedSaleResult.rows.length > 0
        ? latestConfirmedSaleResult.rows[0]
        : null;

    const bestCampaign =
      bestCampaignResult.rows.length > 0
        ? bestCampaignResult.rows[0]
        : null;

    res.status(200).json({
      totalClaims,
      totalConfirmedSales,
      redemptionRate,
      latestConfirmedSale,
      bestCampaign
    });
  } catch (error) {
    console.error("getDashboardSummary error:", error.message);
    res.status(500).json({
      message: "Server error while loading dashboard summary"
    });
  }
};

module.exports = {
  getDashboardSummary
};