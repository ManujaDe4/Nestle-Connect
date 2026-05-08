const pool = require("../config/db");
const { generateRedemptionId, generateOtpCode } = require("../utils/generateCodes");
const sendSMS = require("../services/sms");

const MAX_OTP_ATTEMPTS = 5;
const DEMO_MODE = String(process.env.DEMO_MODE).toLowerCase() === "true";

/**
 * Step 1 of redemption — customer scans shop QR, types voucher code.
 * Generates a fresh PENDING OTP and texts both parties.
 *
 * IMPORTANT: this never marks the voucher redeemed. That only happens
 * after a successful verifyOtpAndRedeem call.
 */
const startRedemption = async (req, res) => {
  try {
    const { voucher_code, shop_slug } = req.body;
    if (!voucher_code || !shop_slug) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const shopResult = await pool.query("SELECT * FROM shops WHERE qr_slug = $1", [shop_slug]);
    if (shopResult.rows.length === 0) return res.status(404).json({ message: "Shop not found" });
    const shop = shopResult.rows[0];

    const voucherResult = await pool.query("SELECT * FROM vouchers WHERE voucher_code = $1", [voucher_code]);
    if (voucherResult.rows.length === 0) return res.status(404).json({ message: "Voucher not found" });
    const voucher = voucherResult.rows[0];

    if (voucher.claim_status === "redeemed") {
      return res.status(400).json({ message: "Voucher already redeemed" });
    }
    if (voucher.claim_status === "expired" || voucher.expiry_status === "expired") {
      return res.status(400).json({ message: "Voucher has expired" });
    }
    if (voucher.claim_status === "disabled") {
      return res.status(400).json({ message: "Voucher is disabled" });
    }

    // Block only ACTIVE pending redemptions. A previous expired/failed
    // attempt should not lock the customer out forever.
    const activePending = await pool.query(
      `SELECT * FROM redemptions
        WHERE claim_id = $1
          AND final_status = 'pending'
          AND otp_status = 'pending'
          AND otp_expires_at > NOW()`,
      [voucher.claim_id]
    );
    if (activePending.rows.length > 0) {
      return res.status(400).json({
        message: "An OTP was already sent for this voucher. Please wait for it to expire or use the existing OTP."
      });
    }

    const redemptionId = generateRedemptionId();
    const otpCode = generateOtpCode();

    const insertQuery = `
      INSERT INTO redemptions
        (redemption_id, claim_id, shop_id, otp_code,
         otp_status, final_status, otp_expires_at, otp_attempts)
      VALUES ($1, $2, $3, $4, 'pending', 'pending', NOW() + INTERVAL '5 minutes', 0)
      RETURNING *;
    `;
    const insertValues = [redemptionId, voucher.claim_id, shop.shop_id, otpCode];
    const redemptionResult = await pool.query(insertQuery, insertValues);

    sendSMS(
      voucher.customer_mobile,
      `Your Nestle Connect OTP is ${otpCode}. Share it with the shop owner. Valid for 5 minutes.`,
      "otp_customer", redemptionId
    ).catch(e => console.error("OTP customer SMS failed:", e));

    sendSMS(
      shop.owner_mobile,
      `A customer is redeeming a voucher at your shop. Their OTP is ${otpCode}. Valid for 5 minutes.`,
      "otp_shop_owner", redemptionId
    ).catch(e => console.error("OTP shop SMS failed:", e));

    // Strip otp_code from response unless explicit demo mode.
    const safeRedemption = { ...redemptionResult.rows[0] };
    if (!DEMO_MODE) delete safeRedemption.otp_code;

    res.status(201).json({
      message: "OTP generated and sent to customer and shop owner",
      redemption: safeRedemption,
      demo_mode: DEMO_MODE
    });
  } catch (error) {
    console.error("startRedemption error:", error);
    res.status(500).json({ message: "Server error while starting redemption" });
  }
};

/**
 * Step 2 — shop owner enters the OTP the customer received.
 * Only on success does the voucher transition to 'redeemed'.
 */
const verifyOtpAndRedeem = async (req, res) => {
  try {
    const { otp_code, shop_slug } = req.body;
    if (!otp_code || !shop_slug) {
      return res.status(400).json({ message: "Missing OTP or shop information" });
    }

    const shopResult = await pool.query("SELECT * FROM shops WHERE qr_slug = $1", [shop_slug]);
    if (shopResult.rows.length === 0) return res.status(404).json({ message: "Shop not found" });
    const shop = shopResult.rows[0];

    const pendingResult = await pool.query(
      `SELECT * FROM redemptions
        WHERE shop_id = $1
          AND final_status = 'pending'
          AND otp_status = 'pending'
        ORDER BY created_at DESC
        LIMIT 1`,
      [shop.shop_id]
    );

    if (pendingResult.rows.length === 0) {
      return res.status(404).json({
        message: "No pending redemption found. Ask the customer to start a new redemption."
      });
    }

    const redemption = pendingResult.rows[0];

    if (new Date() > new Date(redemption.otp_expires_at)) {
      await pool.query(
        "UPDATE redemptions SET otp_status='expired', final_status='expired' WHERE redemption_id=$1",
        [redemption.redemption_id]
      );
      return res.status(400).json({ message: "OTP expired. Please start the redemption again." });
    }

    if (String(redemption.otp_code) !== String(otp_code).trim()) {
      const newAttempts = (redemption.otp_attempts || 0) + 1;
      if (newAttempts >= MAX_OTP_ATTEMPTS) {
        await pool.query(
          "UPDATE redemptions SET otp_attempts=$1, otp_status='failed', final_status='failed' WHERE redemption_id=$2",
          [newAttempts, redemption.redemption_id]
        );
        return res.status(429).json({
          message: "Too many incorrect attempts. This redemption has been cancelled — start over."
        });
      }
      await pool.query(
        "UPDATE redemptions SET otp_attempts=$1 WHERE redemption_id=$2",
        [newAttempts, redemption.redemption_id]
      );
      return res.status(400).json({
        message: `Incorrect OTP. ${MAX_OTP_ATTEMPTS - newAttempts} attempt(s) remaining.`
      });
    }

    await pool.query("BEGIN");
    try {
      await pool.query(
        `UPDATE redemptions SET otp_status='verified', final_status='redeemed',
                redeemed_at=CURRENT_TIMESTAMP
          WHERE redemption_id=$1`,
        [redemption.redemption_id]
      );
      await pool.query(
        "UPDATE vouchers SET claim_status='redeemed' WHERE claim_id=$1",
        [redemption.claim_id]
      );
      await pool.query("COMMIT");
    } catch (txErr) {
      await pool.query("ROLLBACK");
      throw txErr;
    }

    res.status(200).json({
      message: "Voucher redeemed successfully",
      redemption_id: redemption.redemption_id
    });
  } catch (error) {
    console.error("verifyOtpAndRedeem error:", error);
    res.status(500).json({ message: "Server error while verifying OTP" });
  }
};

module.exports = { startRedemption, verifyOtpAndRedeem };
