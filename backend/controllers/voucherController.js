const pool = require("../config/db");
const { generateClaimId, generateVoucherCode } = require("../utils/generateCodes");
const normalizeMobile = require("../utils/normalizeMobile");
const sendSMS = require("../services/sms");

const claimVoucher = async (req, res) => {
  try {
    let { customer_mobile, campaign_id, ad_id } = req.body;

    if (!customer_mobile || !campaign_id || !ad_id) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    customer_mobile = normalizeMobile(customer_mobile);

    // Check if requested campaign exists
    let campaignCheck = await pool.query(
      `SELECT * FROM campaigns WHERE campaign_id = $1`,
      [campaign_id]
    );

    let campaign = campaignCheck.rows.length > 0 ? campaignCheck.rows[0] : null;
    
    // Auto-heal: If campaign is not found, expired, or disabled, fall back to the currently active campaign
    if (!campaign || campaign.status !== 'active' || new Date(campaign.end_date) <= new Date()) {
      const activeCheck = await pool.query(
        "SELECT * FROM campaigns WHERE status = 'active' AND end_date > NOW() ORDER BY created_at DESC LIMIT 1"
      );
      
      if (activeCheck.rows.length > 0) {
        campaign = activeCheck.rows[0];
        campaign_id = campaign.campaign_id; // Override with the real active campaign
      } else {
        // Only fail if there are genuinely no active campaigns in the entire system
        return res.status(400).json({ 
          message: "Campaign is disabled and not accepting claims" 
        });
      }
    }

    const existingVoucherQuery = `
      SELECT * FROM vouchers
      WHERE customer_mobile = $1 AND ad_id = $2
      LIMIT 1;
    `;

    const existingVoucherResult = await pool.query(existingVoucherQuery, [
      customer_mobile,
      ad_id
    ]);

    if (existingVoucherResult.rows.length > 0) {
      return res.status(200).json({
        message: "This customer has already claimed a voucher for this advertisement.",
        already_claimed: true,
        voucher: existingVoucherResult.rows[0]
      });
    }

    const claimId = generateClaimId();
    const voucherCode = generateVoucherCode();

    const insertQuery = `
      INSERT INTO vouchers
      (claim_id, campaign_id, ad_id, customer_mobile, voucher_code, claim_status, expiry_status, sms_sent)
      VALUES ($1, $2, $3, $4, $5, 'claimed', 'active', true)
      RETURNING *;
    `;

    const values = [claimId, campaign_id, ad_id, customer_mobile, voucherCode];
    const result = await pool.query(insertQuery, values);

    await sendSMS(
      customer_mobile,
      `Your Nestlé voucher code is ${voucherCode}`,
      "voucher_customer",
      claimId
    );

    res.status(201).json({
      message: "Voucher claimed successfully",
      already_claimed: false,
      sms_message: `Voucher code ${voucherCode} sent to customer ${customer_mobile}.`,
      voucher: result.rows[0]
    });
  } catch (error) {
    console.error("claimVoucher error:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        message: "A voucher has already been claimed for this advertisement by this customer."
      });
    }

    res.status(500).json({ message: "Server error while claiming voucher" });
  }
};

module.exports = { claimVoucher };