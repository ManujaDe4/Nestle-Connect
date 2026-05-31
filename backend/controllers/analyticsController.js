const pool = require('../config/db');

/**
 * Build parameterized WHERE conditions scoping a query to the requesting user's
 * territory. FSM sees their province+region; ASM sees their province; DM Team
 * and admin roles get no restriction (empty conditions → no WHERE clause).
 *
 * @param {object} user   - req.user (from JWT)
 * @param {string} alias  - table alias prefix, e.g. 'u' or 's'
 * @returns {{ conditions: string[], params: any[] }}
 */
function buildTerritoryScope(user, alias) {
  const t = alias ? `${alias}.` : '';
  const conditions = [];
  const params = [];

  if (user.role === 'field_sales_manager') {
    if (user.province) { params.push(user.province); conditions.push(`${t}province = $${params.length}`); }
    if (user.region)   { params.push(user.region);   conditions.push(`${t}region = $${params.length}`); }
  } else if (user.role === 'area_sales_manager') {
    if (user.province) { params.push(user.province); conditions.push(`${t}province = $${params.length}`); }
  }
  // DM Team / admin: no restrictions
  return { conditions, params };
}

/**
 * Track A — Top customers by redemption frequency.
 * Visible: Digital Marketing Team only.
 */
const getTopCustomers = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        v.customer_mobile,
        COUNT(*) AS total_redemptions,
        MIN(r.redeemed_at) AS first_redemption,
        MAX(r.redeemed_at) AS last_redemption
      FROM redemptions r
      JOIN vouchers v ON r.claim_id = v.claim_id
      WHERE r.final_status = 'redeemed'
      GROUP BY v.customer_mobile
      ORDER BY total_redemptions DESC
      LIMIT 50
    `);
    res.json({ customers: result.rows });
  } catch (err) {
    console.error('getTopCustomers error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Track B-A — Shop sales performance (total redemptions per shop).
 * Visible: ASM + FSM (territory-scoped) + DM Team (all).
 */
const getShopPerformance = async (req, res) => {
  try {
    const { conditions, params } = buildTerritoryScope(req.user, 's');
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(`
      SELECT
        s.shop_id,
        s.shop_name,
        s.province,
        s.region,
        s.area,
        COUNT(r.id) AS total_redemptions,
        COUNT(DISTINCT v.customer_mobile) AS unique_customers
      FROM shops s
      LEFT JOIN redemptions r ON r.shop_id = s.shop_id AND r.final_status = 'redeemed'
      LEFT JOIN vouchers v ON r.claim_id = v.claim_id
      ${where}
      GROUP BY s.id, s.shop_id, s.shop_name, s.province, s.region, s.area
      ORDER BY total_redemptions DESC
    `, params);

    res.json({ shops: result.rows });
  } catch (err) {
    console.error('getShopPerformance error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Track B-B — Field rep performance (shops registered + total sales).
 * Visible: ASM + FSM (territory-scoped).
 */
const getRepPerformance = async (req, res) => {
  try {
    const { conditions, params } = buildTerritoryScope(req.user, 'u');
    const roleParam = params.length + 1;
    params.push('sales_distributor');
    const where = conditions.length
      ? `WHERE u.role = $${roleParam} AND ${conditions.join(' AND ')}`
      : `WHERE u.role = $${roleParam}`;

    const result = await pool.query(`
      SELECT
        u.id,
        u.username,
        u.employee_id,
        u.province,
        u.region,
        u.area,
        COUNT(DISTINCT s.id) AS shops_registered,
        COUNT(r.id) AS total_sales
      FROM users u
      LEFT JOIN shops s ON s.created_by_rep_id = u.id
      LEFT JOIN redemptions r ON r.shop_id = s.shop_id AND r.final_status = 'redeemed'
      ${where}
      GROUP BY u.id, u.username, u.employee_id, u.province, u.region, u.area
      ORDER BY total_sales DESC
    `, params);

    res.json({ reps: result.rows });
  } catch (err) {
    console.error('getRepPerformance error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Track B-C — Regional manager (FSM) performance, aggregate by region.
 * Visible: ASM only (scoped to their province).
 */
const getRegionalManagerPerformance = async (req, res) => {
  try {
    const params = [];
    let where = `WHERE u.role = 'field_sales_manager'`;
    if (req.user.province) {
      params.push(req.user.province);
      where += ` AND u.province = $${params.length}`;
    }

    const result = await pool.query(`
      SELECT
        u.id,
        u.username,
        u.employee_id,
        u.province,
        u.region,
        COUNT(DISTINCT s.id) AS shops_in_region,
        COUNT(r.id) AS aggregate_sales,
        COUNT(DISTINCT c.campaign_id) AS active_campaigns
      FROM users u
      LEFT JOIN shops s ON s.province = u.province AND s.region = u.region
      LEFT JOIN redemptions r ON r.shop_id = s.shop_id AND r.final_status = 'redeemed'
      LEFT JOIN vouchers v ON r.claim_id = v.claim_id
      LEFT JOIN campaigns c ON v.campaign_id = c.campaign_id AND c.status = 'active'
      ${where}
      GROUP BY u.id, u.username, u.employee_id, u.province, u.region
      ORDER BY aggregate_sales DESC
    `, params);

    res.json({ regional_managers: result.rows });
  } catch (err) {
    console.error('getRegionalManagerPerformance error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Track B-D — Zonal manager (ASM) performance, aggregate by province.
 * Visible: Digital Marketing Team only.
 */
const getZonalManagerPerformance = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        u.id,
        u.username,
        u.employee_id,
        u.province,
        COUNT(r.id) AS aggregate_sales,
        COUNT(DISTINCT s.id) AS shops_in_province,
        COUNT(DISTINCT c.campaign_id) AS active_campaigns
      FROM users u
      LEFT JOIN shops s ON s.province = u.province
      LEFT JOIN redemptions r ON r.shop_id = s.shop_id AND r.final_status = 'redeemed'
      LEFT JOIN vouchers v ON r.claim_id = v.claim_id
      LEFT JOIN campaigns c ON v.campaign_id = c.campaign_id AND c.status = 'active'
      WHERE u.role = 'area_sales_manager'
      GROUP BY u.id, u.username, u.employee_id, u.province
      ORDER BY aggregate_sales DESC
    `);

    res.json({ zonal_managers: result.rows });
  } catch (err) {
    console.error('getZonalManagerPerformance error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getTopCustomers,
  getShopPerformance,
  getRepPerformance,
  getRegionalManagerPerformance,
  getZonalManagerPerformance
};
