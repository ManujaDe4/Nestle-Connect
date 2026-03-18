const pool = require("../config/db");
const { generateClaimId, generateVoucherCode } = require("../utils/generateCodes");

const claimVoucher = async (req, res) => {
  try {
    const { customer_mobile, campaign_id, ad_id } = req.body;

    if (!customer_mobile || !campaign_id || !ad_id) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const claimId = generateClaimId();
    const voucherCode = generateVoucherCode();

    const query = `
      INSERT INTO vouchers
      (claim_id, campaign_id, ad_id, customer_mobile, voucher_code, claim_status, sms_sent)
      VALUES ($1, $2, $3, $4, $5, 'claimed', true)
      RETURNING *;
    `;

    const values = [claimId, campaign_id, ad_id, customer_mobile, voucherCode];
    const result = await pool.query(query, values);

    res.status(201).json({
      message: "Voucher claimed successfully",
      sms_message: `Voucher code ${voucherCode} sent to customer ${customer_mobile} (simulated).`,
      voucher: result.rows[0],
    });
  } catch (error) {
    console.error("claimVoucher error:", error);
    res.status(500).json({ message: "Server error while claiming voucher" });
  }
};

module.exports = { claimVoucher };