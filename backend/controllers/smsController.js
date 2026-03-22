const pool = require("../config/db");

const getAllSMSLogs = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM sms_logs ORDER BY created_at DESC"
    );

    res.status(200).json(result.rows);
  } catch (error) {
    console.error("getAllSMSLogs error:", error.message);
    res.status(500).json({ message: "Server error while fetching SMS logs" });
  }
};

module.exports = {
  getAllSMSLogs
};