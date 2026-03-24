const axios = require("axios");
const pool = require("../config/db");

async function sendSMS(to, message, smsType = "general", relatedId = null) {
  const token = process.env.TEXTLK_API_TOKEN;
  const senderId = process.env.TEXTLK_SENDER_ID || "TextLKDemo";

  // normalize 0771234567 -> 94771234567
  let recipient = to.replace(/\s+/g, "").replace(/-/g, "");
  if (recipient.startsWith("+94")) recipient = recipient.slice(1);
  if (recipient.startsWith("0")) recipient = "94" + recipient.slice(1);

  try {
    const res = await axios.post(
      "https://app.text.lk/api/v3/sms/send",
      {
        recipient,
        sender_id: senderId,
        type: "plain",
        message
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json"
        }
      }
    );

    // log sent SMS
    await pool.query(
      `INSERT INTO sms_logs (recipient_mobile, message, sms_type, related_id, status)
       VALUES ($1, $2, $3, $4, $5)`,
      [to, message, smsType, relatedId, "sent"]
    );

    return {
      success: true,
      provider: "textlk",
      response: res.data
    };
  } catch (error) {
    console.error("Text.lk SMS error:", error.response?.data || error.message);

    // fallback log
    await pool.query(
      `INSERT INTO sms_logs (recipient_mobile, message, sms_type, related_id, status)
       VALUES ($1, $2, $3, $4, $5)`,
      [to, message, smsType, relatedId, "failed"]
    );

    return {
      success: false,
      provider: "textlk",
      error: error.response?.data || error.message
    };
  }
}

module.exports = sendSMS;