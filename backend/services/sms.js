const pool = require("../config/db");

async function sendSMS(to, message, smsType = "general", relatedId = null) {
  try {
    console.log("========== SMS SIMULATION ==========");
    console.log("To:", to);
    console.log("Type:", smsType);
    console.log("Related ID:", relatedId);
    console.log("Message:", message);
    console.log("====================================");

    const query = `
      INSERT INTO sms_logs (recipient_mobile, message, sms_type, related_id, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;

    const values = [to, message, smsType, relatedId, "simulated"];
    const result = await pool.query(query, values);

    return {
      success: true,
      simulated: true,
      sms: result.rows[0]
    };
  } catch (error) {
    console.error("SMS simulation error:", error.message);
    return {
      success: false,
      simulated: true,
      error: error.message
    };
  }
}

module.exports = sendSMS;