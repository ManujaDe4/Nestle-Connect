const pool = require('../config/db');
const { logActivity } = require('./activityController');

// Create a new campaign
const createCampaign = async (req, res) => {
  try {
    const { campaign_id, campaign_name, description, start_date, end_date } = req.body;

    if (!campaign_id || !campaign_name || !start_date || !end_date) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Validate dates
    const start = new Date(start_date);
    const end = new Date(end_date);
    if (start >= end) {
      return res.status(400).json({ message: 'End date must be after start date' });
    }

    const result = await pool.query(
      `INSERT INTO campaigns (campaign_id, campaign_name, description, start_date, end_date, status)
       VALUES ($1, $2, $3, $4, $5, 'active')
       RETURNING *`,
      [campaign_id, campaign_name, description, start_date, end_date]
    );

    await logActivity({
      userId: req.user.id,
      action: 'campaign_created',
      detail: `Created campaign ${campaign_id} (${campaign_name}) ending at ${end_date}`
    });

    res.status(201).json({
      message: 'Campaign created successfully',
      campaign: result.rows[0]
    });
  } catch (error) {
    console.error('createCampaign error:', error);
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Campaign ID already exists' });
    }
    res.status(500).json({ message: 'Server error while creating campaign' });
  }
};

// Get all campaigns
const getAllCampaigns = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM campaigns ORDER BY end_date DESC'
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('getAllCampaigns error:', error);
    res.status(500).json({ message: 'Server error while fetching campaigns' });
  }
};

// Get campaign details
const getCampaignById = async (req, res) => {
  try {
    const { campaign_id } = req.params;
    const result = await pool.query(
      'SELECT * FROM campaigns WHERE campaign_id = $1',
      [campaign_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('getCampaignById error:', error);
    res.status(500).json({ message: 'Server error while fetching campaign' });
  }
};

// Check and auto-expire campaigns
const checkAndExpireCampaigns = async () => {
  try {
    const now = new Date();
    
    // Find campaigns that have ended
    const expiredCampaigns = await pool.query(
      `SELECT * FROM campaigns 
       WHERE end_date <= $1 AND status != 'expired'`,
      [now]
    );

    for (const campaign of expiredCampaigns.rows) {
      // Update campaign status to expired
      await pool.query(
        `UPDATE campaigns SET status = 'expired' WHERE id = $1`,
        [campaign.id]
      );

      // Mark all vouchers for this campaign as expired
      await pool.query(
        `UPDATE vouchers SET expiry_status = 'expired', claim_status = 'expired' 
         WHERE campaign_id = $1 AND expiry_status = 'active'`,
        [campaign.campaign_id]
      );

      console.log(`Campaign ${campaign.campaign_id} expired and vouchers disabled`);
    }
  } catch (error) {
    console.error('checkAndExpireCampaigns error:', error);
  }
};

// Manually expire a campaign
const expireCampaign = async (req, res) => {
  try {
    const { campaign_id } = req.body;

    // Update campaign status
    const campaignResult = await pool.query(
      `UPDATE campaigns SET status = 'expired' WHERE campaign_id = $1 RETURNING *`,
      [campaign_id]
    );

    if (campaignResult.rows.length === 0) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    // Mark all active vouchers for this campaign as expired
    const expireResult = await pool.query(
      `UPDATE vouchers SET expiry_status = 'expired', claim_status = 'expired' 
       WHERE campaign_id = $1 AND expiry_status = 'active'
       RETURNING COUNT(*) as count`,
      [campaign_id]
    );

    await logActivity({
      userId: req.user.id,
      action: 'campaign_expired',
      detail: `Manually expired campaign ${campaign_id}`
    });

    res.status(200).json({
      message: 'Campaign expired successfully',
      campaign: campaignResult.rows[0]
    });
  } catch (error) {
    console.error('expireCampaign error:', error);
    res.status(500).json({ message: 'Server error while expiring campaign' });
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
       FROM vouchers WHERE campaign_id = $1`,
      [campaign_id]
    );

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('getCampaignStats error:', error);
    res.status(500).json({ message: 'Server error while fetching campaign stats' });
  }
};

module.exports = { 
  createCampaign, 
  getAllCampaigns, 
  getCampaignById,
  checkAndExpireCampaigns,
  expireCampaign,
  getCampaignStats
};
