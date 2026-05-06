const pool = require("../config/db");

// Create a new campaign and disable old ones
const createCampaign = async (req, res) => {
  try {
    console.log("createCampaign called with:", JSON.stringify(req.body, null, 2));
    console.log("User role:", req.user?.role);

    const { 
      campaign_id, campaign_name, description, start_date, end_date,
      objective, target_audience, voucher_value, voucher_limit, budget, banner_url
    } = req.body;

    if (!campaign_id || !campaign_name || !start_date || !end_date) {
      console.log("Validation failed: Missing required fields");
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Check if campaign_id already exists
    const existingCheck = await pool.query(
      "SELECT * FROM campaigns WHERE campaign_id = $1",
      [campaign_id]
    );

    if (existingCheck.rows.length > 0) {
      console.log("Validation failed: Campaign ID already exists:", campaign_id);
      return res.status(409).json({ message: "Campaign ID already exists" });
    }

    // Multiple campaigns can now run concurrently.
    console.log("Proceeding to insert campaign...");

    // Insert new campaign
    const insertQuery = `
      INSERT INTO campaigns (
        campaign_id, campaign_name, description, start_date, end_date, status,
        objective, target_audience, voucher_value, voucher_limit, budget, banner_url
      )
      VALUES ($1, $2, $3, $4, $5, 'active', $6, $7, $8, $9, $10, $11)
      RETURNING *;
    `;

    const result = await pool.query(insertQuery, [
      campaign_id,
      campaign_name,
      description || null,
      start_date,
      end_date,
      objective || null,
      target_audience || null,
      voucher_value || null,
      voucher_limit || null,
      budget || null,
      banner_url || null
    ]);

    console.log("Campaign created successfully:", result.rows[0].campaign_id);

    res.status(201).json({
      message: "Campaign created successfully.",
      campaign: result.rows[0]
    });
  } catch (error) {
    console.error("createCampaign error details:", error);
    res.status(500).json({ message: "Server error while creating campaign" });
  }
};

// Update an existing campaign
const updateCampaign = async (req, res) => {
  try {
    const { id } = req.params; // this is the campaign_id string, not the integer PK
    const { 
      campaign_name, description, start_date, end_date,
      objective, target_audience, voucher_value, voucher_limit, budget, banner_url, status
    } = req.body;

    // Check if campaign exists
    const existingCheck = await pool.query(
      "SELECT * FROM campaigns WHERE campaign_id = $1",
      [id]
    );

    if (existingCheck.rows.length === 0) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    const updateQuery = `
      UPDATE campaigns 
      SET 
        campaign_name = $1, 
        description = $2, 
        start_date = $3, 
        end_date = $4,
        objective = $5,
        target_audience = $6,
        voucher_value = $7,
        voucher_limit = $8,
        budget = $9,
        banner_url = $10,
        status = $11,
        updated_at = CURRENT_TIMESTAMP
      WHERE campaign_id = $12
      RETURNING *;
    `;

    const result = await pool.query(updateQuery, [
      campaign_name || existingCheck.rows[0].campaign_name,
      description !== undefined ? description : existingCheck.rows[0].description,
      start_date || existingCheck.rows[0].start_date,
      end_date || existingCheck.rows[0].end_date,
      objective !== undefined ? objective : existingCheck.rows[0].objective,
      target_audience !== undefined ? target_audience : existingCheck.rows[0].target_audience,
      voucher_value !== undefined ? voucher_value : existingCheck.rows[0].voucher_value,
      voucher_limit !== undefined ? voucher_limit : existingCheck.rows[0].voucher_limit,
      budget !== undefined ? budget : existingCheck.rows[0].budget,
      banner_url !== undefined ? banner_url : existingCheck.rows[0].banner_url,
      status || existingCheck.rows[0].status,
      id
    ]);

    res.status(200).json({
      message: "Campaign updated successfully",
      campaign: result.rows[0]
    });
  } catch (error) {
    console.error("updateCampaign error:", error);
    res.status(500).json({ message: "Server error while updating campaign" });
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

// Delete a campaign (with admin password verification)
const deleteCampaign = async (req, res) => {
  try {
    const { campaign_id } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ message: "Admin password required to delete a campaign" });
    }

    // Verify admin password
    const bcrypt = require('bcrypt');
    const adminResult = await pool.query('SELECT * FROM users WHERE id = $1 AND role = $2', [req.user.id, 'admin']);
    if (adminResult.rows.length === 0) {
      return res.status(403).json({ message: "Admin account not found" });
    }
    const isMatch = await bcrypt.compare(password, adminResult.rows[0].password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: "Incorrect password. Deletion cancelled." });
    }

    // Check campaign exists
    const campaignCheck = await pool.query('SELECT * FROM campaigns WHERE campaign_id = $1', [campaign_id]);
    if (campaignCheck.rows.length === 0) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    // Delete associated vouchers first
    await pool.query('DELETE FROM vouchers WHERE campaign_id = $1', [campaign_id]);

    // Delete the campaign
    await pool.query('DELETE FROM campaigns WHERE campaign_id = $1', [campaign_id]);

    res.json({ message: `Campaign ${campaign_id} and all associated vouchers deleted successfully.` });
  } catch (error) {
    console.error("deleteCampaign error:", error);
    res.status(500).json({ message: "Server error while deleting campaign" });
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
  updateCampaign,
  getAllCampaigns,
  getActiveCampaigns,
  getCampaignById,
  expireCampaign,
  getCampaignStats,
  deleteCampaign,
  checkAndExpireCampaigns
};

