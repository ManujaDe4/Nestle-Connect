const pool = require('../config/db');

const logActivity = async ({ userId, shopId = null, action, detail }) => {
  try {
    await pool.query(
      'INSERT INTO activity_logs (user_id, shop_id, action, detail) VALUES ($1, $2, $3, $4)',
      [userId, shopId, action, detail]
    );
  } catch (error) {
    console.error('logActivity error:', error);
  }
};

const getActivityLog = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        al.id,
        al.action,
        al.detail,
        al.created_at,
        u.username AS performed_by,
        s.shop_id,
        s.shop_name
      FROM activity_logs al
      LEFT JOIN users u ON al.user_id = u.id
      LEFT JOIN shops s ON al.shop_id = s.id
      ORDER BY al.created_at DESC
    `);

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('getActivityLog error:', error);
    res.status(500).json({ message: 'Server error while loading activity log' });
  }
};

module.exports = { logActivity, getActivityLog };