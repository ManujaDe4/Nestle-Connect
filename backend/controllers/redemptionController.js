const pool = require("../config/db");
const { generateRedemptionId, generateOtpCode } = require("../utils/generateCodes");
const sendSMS = require("../services/sms");

const startRedemption = async (req, res) => {
  try {
    const { voucher_code, shop_slug } = req.body;

    if (!voucher_code || !shop_slug) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Find shop
    const shopResult = await pool.query(
      "SELECT * FROM shops WHERE qr_slug = $1",
      [shop_slug]
    );

    if (shopResult.rows.length === 0) {
      return res.status(404).json({ message: "Shop not found" });
    }

    const shop = shopResult.rows[0];

    // Find voucher
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

    // Prevent multiple active redemptions for same voucher
    const pendingCheck = await pool.query(
      "SELECT * FROM redemptions WHERE claim_id = $1",
      [voucher.claim_id]
    );

    if (pendingCheck.rows.length > 0) {
      return res.status(400).json({ message: "Redemption already started for this voucher" });
    }

    const redemptionId = generateRedemptionId();
    const otpCode = generateOtpCode();

    const insertQuery = `
      INSERT INTO redemptions
      (redemption_id, claim_id, shop_id, otp_code, otp_status, final_status, otp_expires_at, otp_attempts, redeemed_at)
      VALUES ($1, $2, $3, $4, 'verified', 'redeemed', NOW() + INTERVAL '5 minutes', 0, CURRENT_TIMESTAMP)
      RETURNING *;
    `;

    const insertValues = [redemptionId, voucher.claim_id, shop.shop_id, otpCode];
    const redemptionResult = await pool.query(insertQuery, insertValues);

    // OTP to customer
    await sendSMS(
      voucher.customer_mobile,
      `Your OTP is ${otpCode}. Share this with the shop owner. Valid for 5 minutes.`,
      "otp_customer",
      redemptionId
    );

    // OTP to shop owner
    await sendSMS(
      shop.owner_mobile,
      `Customer OTP is ${otpCode}. Use this to verify redemption. Valid for 5 minutes.`,
      "otp_shop_owner",
      redemptionId
    );

    // Update voucher claim_status to redeemed as soon as OTP is sent
    await pool.query(
      `UPDATE vouchers
       SET claim_status = 'redeemed'
       WHERE claim_id = $1`,
      [voucher.claim_id]
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
    const { otp_code, shop_slug } = req.body;

    if (!otp_code || !shop_slug) {
      return res.status(400).json({ message: "Missing OTP or shop information" });
    }

    // Find shop
    const shopResult = await pool.query(
      "SELECT * FROM shops WHERE qr_slug = $1",
      [shop_slug]
    );

    if (shopResult.rows.length === 0) {
      return res.status(404).json({ message: "Shop not found" });
    }

    const shop = shopResult.rows[0];

    // Find redemption by shop + OTP
    const redemptionResult = await pool.query(
      `SELECT * FROM redemptions
       WHERE shop_id = $1
         AND otp_code = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [shop.shop_id, otp_code]
    );

    if (redemptionResult.rows.length === 0) {
      return res.status(404).json({ message: "No matching pending redemption found for this OTP." });
    }

    const redemption = redemptionResult.rows[0];

    // Expiry check
    if (new Date() > new Date(redemption.otp_expires_at)) {
      return res.status(400).json({ message: "OTP expired. Please start redemption again." });
    }

    // Mark redemption as successful
    await pool.query(
      `UPDATE redemptions
       SET otp_status = 'verified',
           final_status = 'redeemed',
           redeemed_at = CURRENT_TIMESTAMP
       WHERE redemption_id = $1`,
      [redemption.redemption_id]
    );

    await pool.query(
      `UPDATE vouchers
       SET claim_status = 'redeemed'
       WHERE claim_id = $1`,
      [redemption.claim_id]
    );

    res.status(200).json({
      message: "Voucher redeemed successfully",
      redemption_id: redemption.redemption_id
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