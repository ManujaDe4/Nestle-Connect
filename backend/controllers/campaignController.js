const pool = require("../config/db");

// Create a new campaign and disable old ones
const createCampaign = async (req, res) => {
  try {
    const { campaign_id, campaign_name, description, start_date, end_date } = req.body;

    if (!campaign_id || !campaign_name || !start_date || !end_date) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Check if campaign_id already exists
    const existingCheck = await pool.query(
      "SELECT * FROM campaigns WHERE campaign_id = $1",
      [campaign_id]
    );

    if (existingCheck.rows.length > 0) {
      return res.status(409).json({ message: "Campaign ID already exists" });
    }

    // Disable all previously active campaigns when a new one is created
    await pool.query(
      "UPDATE campaigns SET status = $1 WHERE status = $2",
      ["disabled", "active"]
    );

    // Insert new campaign
    const insertQuery = `
      INSERT INTO campaigns (campaign_id, campaign_name, description, start_date, end_date, status)
      VALUES ($1, $2, $3, $4, $5, 'active')
      RETURNING *;
    `;

    const result = await pool.query(insertQuery, [
      campaign_id,
      campaign_name,
      description || null,
      start_date,
      end_date
    ]);

    res.status(201).json({
      message: "Campaign created successfully. Previous campaigns disabled.",
      campaign: result.rows[0]
    });
  } catch (error) {
    console.error("createCampaign error:", error);
    res.status(500).json({ message: "Server error while creating campaign" });
  }
};

// Get all campaigns
const getAllCampaigns = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM campaigns ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch (error) {
    console.error("getAllCampaigns error:", error);
    res.status(500).json({ message: "Server error fetching campaigns" });
  }
};

// Get only active campaigns
const getActiveCampaigns = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM campaigns WHERE status = 'active' AND end_date > NOW() ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch (error) {
    console.error("getActiveCampaigns error:", error);
    res.status(500).json({ message: "Server error fetching active campaigns" });
  }
};

// Get campaign by ID
const getCampaignById = async (req, res) => {
  try {
    const { campaign_id } = req.params;
    const result = await pool.query(
      "SELECT * FROM campaigns WHERE campaign_id = $1",
      [campaign_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("getCampaignById error:", error);
    res.status(500).json({ message: "Server error fetching campaign" });
  }
};

// Manually expire/disable a campaign
const expireCampaign = async (req, res) => {
  try {
    const { campaign_id } = req.body;

    if (!campaign_id) {
      return res.status(400).json({ message: "Campaign ID required" });
    }

    // Check if campaign exists
    const campaignCheck = await pool.query(
      "SELECT * FROM campaigns WHERE campaign_id = $1",
      [campaign_id]
    );

    if (campaignCheck.rows.length === 0) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    // Update campaign status to expired
    await pool.query(
      "UPDATE campaigns SET status = $1 WHERE campaign_id = $2",
      ["expired", campaign_id]
    );

    // Disable all vouchers for this campaign
    await pool.query(
      "UPDATE vouchers SET claim_status = $1, expiry_status = $2 WHERE campaign_id = $3",
      ["expired", "expired", campaign_id]
    );

    res.json({
      message: "Campaign expired successfully. All associated vouchers disabled.",
      campaign_id: campaign_id
    });
  } catch (error) {
    console.error("expireCampaign error:", error);
    res.status(500).json({ message: "Server error expiring campaign" });
  }
};

// Get campaign statistics
const getCampaignStats = async (req, res) => {
  try {
    const { campaign_id } = req.params;

    const result = await pool.query(
      `SELECT 
        COUNT(*) as total_vouchers,
        SUM(CASE WHEN claim_status = 'redeemed' THEN 1 ELSE 0 END) as redeemed_count,
        SUM(CASE WHEN claim_status = 'expired' THEN 1 ELSE 0 END) as expired_count,
        SUM(CASE WHEN claim_status = 'claimed' THEN 1 ELSE 0 END) as claimed_count
      FROM vouchers
      WHERE campaign_id = $1`,
      [campaign_id]
    );

    res.json({
      campaign_id: campaign_id,
      total_vouchers: parseInt(result.rows[0].total_vouchers, 10) || 0,
      redeemed_count: parseInt(result.rows[0].redeemed_count, 10) || 0,
      expired_count: parseInt(result.rows[0].expired_count, 10) || 0,
      claimed_count: parseInt(result.rows[0].claimed_count, 10) || 0
    });
  } catch (error) {
    console.error("getCampaignStats error:", error);
    res.status(500).json({ message: "Server error fetching campaign stats" });
  }
};

// Auto-expire campaigns that have reached their end_date
const checkAndExpireCampaigns = async () => {
  try {
    // Find campaigns that have passed their end_date
    const expiredCampaigns = await pool.query(
      `SELECT campaign_id FROM campaigns 
       WHERE status = 'active' AND end_date <= NOW()`
    );

    for (const campaign of expiredCampaigns.rows) {
      // Update campaign status to expired
      await pool.query(
        "UPDATE campaigns SET status = $1 WHERE campaign_id = $2",
        ["expired", campaign.campaign_id]
      );

      // Disable all vouchers for this campaign
      await pool.query(
        "UPDATE vouchers SET claim_status = $1, expiry_status = $2 WHERE campaign_id = $3 AND claim_status != 'redeemed'",
        ["expired", "expired", campaign.campaign_id]
      );

      console.log(`Campaign ${campaign.campaign_id} auto-expired`);
    }
  } catch (error) {
    console.error("checkAndExpireCampaigns error:", error);
  }
};

module.exports = {
  createCampaign,
  getAllCampaigns,
  getActiveCampaigns,
  getCampaignById,
  expireCampaign,
  getCampaignStats,
  checkAndExpireCampaigns
};
