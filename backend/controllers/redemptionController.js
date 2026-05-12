const pool = require("../config/db");
const { generateRedemptionId, generateOtpCode } = require("../utils/generateCodes");
const sendSMS = require("../services/sms");

const DEMO_MODE = String(process.env.DEMO_MODE).toLowerCase() === "true";

/**
 * Single-step redemption — customer scans shop QR and enters voucher code.
 *
 * The voucher is immediately marked 'redeemed' in the same request.
 * A confirmation OTP/code is sent by SMS to BOTH the customer and the
 * shop owner as a receipt — neither party needs to enter anything further.
 */
const startRedemption = async (req, res) => {
  try {
    const { voucher_code, shop_slug } = req.body;
    if (!voucher_code || !shop_slug) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // ── Validate shop ────────────────────────────────────────────────────────
    const shopResult = await pool.query(
      "SELECT * FROM shops WHERE qr_slug = $1",
      [shop_slug]
    );
    if (shopResult.rows.length === 0) {
      return res.status(404).json({ message: "Shop not found" });
    }
    const shop = shopResult.rows[0];

    // ── Validate voucher ─────────────────────────────────────────────────────
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
    if (voucher.claim_status === "expired" || voucher.expiry_status === "expired") {
      return res.status(400).json({ message: "Voucher has expired" });
    }
    if (voucher.claim_status === "disabled") {
      return res.status(400).json({ message: "Voucher is disabled" });
    }

    // ── Generate confirmation code (sent as receipt, not for verification) ───
    const redemptionId = generateRedemptionId();
    const confirmationCode = generateOtpCode();

    // ── Atomically write redemption + mark voucher redeemed ──────────────────
    await pool.query("BEGIN");
    try {
      await pool.query(
        `INSERT INTO redemptions
           (redemption_id, claim_id, shop_id, otp_code,
            otp_status, final_status, otp_expires_at, otp_attempts, redeemed_at)
         VALUES ($1, $2, $3, $4, 'verified', 'redeemed', NOW() + INTERVAL '5 minutes', 0, CURRENT_TIMESTAMP)`,
        [redemptionId, voucher.claim_id, shop.shop_id, confirmationCode]
      );
      await pool.query(
        "UPDATE vouchers SET claim_status = 'redeemed' WHERE claim_id = $1",
        [voucher.claim_id]
      );
      await pool.query("COMMIT");
    } catch (txErr) {
      await pool.query("ROLLBACK");
      throw txErr;
    }

    // ── Send confirmation SMS to both parties (receipt only) ─────────────────
    sendSMS(
      voucher.customer_mobile,
      `Your Nestlé Connect voucher ${voucher_code} has been successfully redeemed at ${shop.shop_name}. Confirmation code: ${confirmationCode}.`,
      "redemption_customer",
      redemptionId
    ).catch(e => console.error("Confirmation customer SMS failed:", e));

    sendSMS(
      shop.owner_mobile,
      `Voucher ${voucher_code} has been redeemed at your shop. Confirmation code: ${confirmationCode}.`,
      "redemption_shop_owner",
      redemptionId
    ).catch(e => console.error("Confirmation shop SMS failed:", e));

    res.status(201).json({
      message: "Voucher redeemed successfully",
      redemption_id: redemptionId,
      ...(DEMO_MODE && { confirmation_code: confirmationCode }),
      demo_mode: DEMO_MODE
    });
  } catch (error) {
    console.error("startRedemption error:", error);
    res.status(500).json({ message: "Server error while processing redemption" });
  }
};

/**
 * Kept for backwards compatibility — no longer used in the main flow.
 * Returns a clear message so any old client gets a helpful response.
 */
const verifyOtpAndRedeem = async (req, res) => {
  res.status(410).json({
    message:
      "This endpoint is no longer required. Redemption is completed automatically when the customer scans the shop QR and submits their voucher code."
  });
};

module.exports = { startRedemption, verifyOtpAndRedeem };
