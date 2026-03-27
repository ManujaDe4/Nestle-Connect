const pool = require("../config/db");
const { generateRedemptionId, generateOtpCode } = require("../utils/generateCodes");
const sendSMS = require("../services/sms");

const startRedemption = async (req, res) => {
  try {
    const { voucher_code, shop_slug } = req.body;

    if (!voucher_code || !shop_slug) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const shopResult = await pool.query(
      "SELECT * FROM shops WHERE qr_slug = $1",
      [shop_slug]
    );

    if (shopResult.rows.length === 0) {
      return res.status(404).json({ message: "Shop not found" });
    }

    const shop = shopResult.rows[0];

    const voucherResult = await pool.query(
      "SELECT * FROM vouchers WHERE voucher_code = $1",
      [voucher_code]
    );

    if (voucherResult.rows.length === 0) {
      return res.status(404).json({ message: "Voucher not found" });
    }

    const voucher = voucherResult.rows[0];

    if (voucher.claim_status === "redeemed") {
      return res.status(400).json({ message: "Voucher already redeemed" });
    }

    const pendingCheck = await pool.query(
      "SELECT * FROM redemptions WHERE claim_id = $1 AND final_status = 'pending'",
      [voucher.claim_id]
    );

    if (pendingCheck.rows.length > 0) {
      return res.status(400).json({ message: "Redemption already started for this voucher" });
    }

    const redemptionId = generateRedemptionId();
    const otpCode = generateOtpCode();

    const insertQuery = `
      INSERT INTO redemptions
      (redemption_id, claim_id, shop_id, otp_code, otp_status, final_status, otp_expires_at, otp_attempts)
      VALUES ($1, $2, $3, $4, 'sent', 'pending', NOW() + INTERVAL '5 minutes', 0)
      RETURNING *;
    `;

    const insertValues = [redemptionId, voucher.claim_id, shop.shop_id, otpCode];
    const redemptionResult = await pool.query(insertQuery, insertValues);

    await sendSMS(
      voucher.customer_mobile,
      `Your OTP is ${otpCode}. Share this with the shop owner. Valid for 5 minutes.`,
      "otp_customer",
      redemptionId
    );

    await sendSMS(
      shop.owner_mobile,
      `Customer OTP is ${otpCode}. Ask the customer for the same code to verify redemption. Valid for 5 minutes.`,
      "otp_shop_owner",
      redemptionId
    );

    res.status(201).json({
      message: "OTP generated and sent to customer and shop owner",
      redemption: redemptionResult.rows[0]
    });
  } catch (error) {
    console.error("startRedemption error:", error);
    res.status(500).json({ message: "Server error while starting redemption" });
  }
};

const verifyOtpAndRedeem = async (req, res) => {
  try {
    const { redemption_id, otp_code } = req.body;

    if (!redemption_id || !otp_code) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const redemptionResult = await pool.query(
      "SELECT * FROM redemptions WHERE redemption_id = $1",
      [redemption_id]
    );

    if (redemptionResult.rows.length === 0) {
      return res.status(404).json({ message: "Redemption request not found" });
    }

    const redemption = redemptionResult.rows[0];

    if (redemption.final_status === "redeemed") {
      return res.status(400).json({ message: "Redemption already completed" });
    }

    if (new Date() > new Date(redemption.otp_expires_at)) {
      return res.status(400).json({ message: "OTP expired. Please start redemption again." });
    }

    if (redemption.otp_code !== otp_code) {
      await pool.query(
        `UPDATE redemptions
         SET otp_attempts = otp_attempts + 1
         WHERE redemption_id = $1`,
        [redemption_id]
      );

      return res.status(400).json({ message: "Invalid OTP code" });
    }

    await pool.query(
      `UPDATE redemptions
       SET otp_status = 'verified',
           final_status = 'redeemed',
           redeemed_at = CURRENT_TIMESTAMP
       WHERE redemption_id = $1`,
      [redemption_id]
    );

    await pool.query(
      `UPDATE vouchers
       SET claim_status = 'redeemed'
       WHERE claim_id = $1`,
      [redemption.claim_id]
    );

    res.status(200).json({
      message: "Voucher redeemed successfully",
      redemption_id
    });
  } catch (error) {
    console.error("verifyOtpAndRedeem error:", error);
    res.status(500).json({ message: "Server error while verifying OTP" });
  }
};

module.exports = {
  startRedemption,
  verifyOtpAndRedeem
};