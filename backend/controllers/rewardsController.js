const pool = require('../config/db');
const sendSMS = require('../services/sms');

const DM_TEAM = [
  'admin', 'sys_admin',
  'digital_marketing_manager', 'digital_content_specialist',
  'digital_media_performance_manager', 'social_media_influencer_strategist',
  'crm_data_analyst', 'digital_marketing_intern'
];

/** Generate next sequential id with a given prefix, e.g. ALLOC-000001 */
async function generateSequentialId(prefix, table, column) {
  const result = await pool.query(
    `SELECT ${column} FROM ${table} WHERE ${column} LIKE $1 ORDER BY ${column} DESC LIMIT 1`,
    [`${prefix}%`]
  );
  let next = 1;
  if (result.rows.length > 0) {
    const last = result.rows[0][column];
    const num = parseInt(last.replace(prefix, ''), 10);
    if (!isNaN(num)) next = num + 1;
  }
  return `${prefix}${String(next).padStart(6, '0')}`;
}

/**
 * POST /api/rewards/allocate
 * DM Team issues a top-level reward to an ASM (Zonal Manager).
 */
const allocateReward = async (req, res) => {
  const { recipient_id, reward_type, reward_value, reward_description, notes } = req.body;

  if (!recipient_id || !reward_type || reward_value == null) {
    return res.status(400).json({ message: 'recipient_id, reward_type, and reward_value are required.' });
  }
  if (Number(reward_value) <= 0) {
    return res.status(400).json({ message: 'reward_value must be greater than 0.' });
  }

  try {
    // Verify recipient is an area_sales_manager
    const recipientResult = await pool.query(
      'SELECT id, username, role FROM users WHERE id = $1',
      [recipient_id]
    );
    if (recipientResult.rows.length === 0) {
      return res.status(400).json({ message: 'Recipient user not found.' });
    }
    const recipient = recipientResult.rows[0];
    if (recipient.role !== 'area_sales_manager') {
      return res.status(400).json({ message: `Rewards can only be allocated to Zonal Managers (area_sales_manager). Recipient role is '${recipient.role}'.` });
    }

    const allocation_id = await generateSequentialId('ALLOC-', 'reward_allocations', 'allocation_id');

    const insertResult = await pool.query(`
      INSERT INTO reward_allocations
        (allocation_id, issued_by, recipient_id, reward_type, reward_value, reward_description, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [allocation_id, req.user.id, recipient_id, reward_type, reward_value, reward_description || null, notes || null]);

    const allocation = insertResult.rows[0];

    // Audit log
    await pool.query(`
      INSERT INTO reward_audit_logs (event_type, allocation_id, actor_id, detail)
      VALUES ('issued', $1, $2, $3)
    `, [allocation.id, req.user.id, JSON.stringify({
      allocation_id,
      reward_value: Number(reward_value),
      reward_type,
      recipient_username: recipient.username
    })]);

    res.status(201).json({ message: 'Reward allocated successfully.', allocation });
  } catch (err) {
    console.error('allocateReward error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * GET /api/rewards/allocations
 * DM Team: all allocations. ASM: their own.
 */
const getAllocations = async (req, res) => {
  try {
    const isDM = DM_TEAM.includes(req.user.role);
    const params = [];
    let where = '';
    if (!isDM) {
      params.push(req.user.id);
      where = `WHERE ra.recipient_id = $1`;
    }

    const result = await pool.query(`
      SELECT
        ra.*,
        issuer.username AS issued_by_username,
        issuer.employee_id AS issued_by_employee_id,
        recipient.username AS recipient_username,
        recipient.employee_id AS recipient_employee_id,
        recipient.province AS recipient_province,
        COALESCE(SUM(rd.reward_value), 0) AS total_distributed
      FROM reward_allocations ra
      JOIN users issuer ON ra.issued_by = issuer.id
      JOIN users recipient ON ra.recipient_id = recipient.id
      LEFT JOIN reward_distributions rd ON rd.parent_allocation_id = ra.id
      ${where}
      GROUP BY ra.id, issuer.username, issuer.employee_id, recipient.username, recipient.employee_id, recipient.province
      ORDER BY ra.created_at DESC
    `, params);

    res.json({ allocations: result.rows });
  } catch (err) {
    console.error('getAllocations error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * POST /api/rewards/distribute
 * ASM cascades a reward to FSM / SD / Shop.
 * Uses a DB transaction with FOR UPDATE to prevent over-distribution race conditions.
 */
const distributeReward = async (req, res) => {
  const {
    parent_allocation_id,
    recipient_type,
    recipient_user_id,
    recipient_shop_id,
    reward_type,
    reward_value,
    reward_description,
    notes
  } = req.body;

  if (!parent_allocation_id || !recipient_type || !reward_type || reward_value == null) {
    return res.status(400).json({ message: 'parent_allocation_id, recipient_type, reward_type, and reward_value are required.' });
  }
  if (!['regional_manager', 'field_rep', 'shop'].includes(recipient_type)) {
    return res.status(400).json({ message: 'recipient_type must be regional_manager, field_rep, or shop.' });
  }
  if (Number(reward_value) <= 0) {
    return res.status(400).json({ message: 'reward_value must be greater than 0.' });
  }
  if (recipient_type === 'shop' && !recipient_shop_id) {
    return res.status(400).json({ message: 'recipient_shop_id is required for shop distributions.' });
  }
  if (recipient_type !== 'shop' && !recipient_user_id) {
    return res.status(400).json({ message: 'recipient_user_id is required for user distributions.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Step 1: Lock the allocation row and verify ownership
    const allocResult = await client.query(
      'SELECT id, reward_value, status FROM reward_allocations WHERE id = $1 AND recipient_id = $2 FOR UPDATE',
      [parent_allocation_id, req.user.id]
    );
    if (allocResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'Allocation not found or does not belong to you.' });
    }
    const allocation = allocResult.rows[0];

    // Step 2: Guard against over-distribution
    const sumResult = await client.query(
      'SELECT COALESCE(SUM(reward_value), 0) AS total FROM reward_distributions WHERE parent_allocation_id = $1',
      [parent_allocation_id]
    );
    const alreadyDistributed = Number(sumResult.rows[0].total);
    const remaining = Number(allocation.reward_value) - alreadyDistributed;
    if (Number(reward_value) > remaining) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        message: `Distribution would exceed allocation balance. Remaining: ${remaining.toFixed(2)}, Requested: ${Number(reward_value).toFixed(2)}.`
      });
    }

    // Step 3: Validate recipient and territory
    if (recipient_type === 'shop') {
      const shopResult = await client.query(
        'SELECT id, shop_name, province FROM shops WHERE id = $1',
        [recipient_shop_id]
      );
      if (shopResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Shop not found.' });
      }
      if (req.user.province && shopResult.rows[0].province !== req.user.province) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Shop is outside your province.' });
      }
    } else {
      const expectedRole = recipient_type === 'regional_manager' ? 'field_sales_manager' : 'sales_distributor';
      const userResult = await client.query(
        'SELECT id, username, role, province FROM users WHERE id = $1',
        [recipient_user_id]
      );
      if (userResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Recipient user not found.' });
      }
      const recipientUser = userResult.rows[0];
      if (recipientUser.role !== expectedRole) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          message: `Recipient must have role '${expectedRole}' for type '${recipient_type}'. Got '${recipientUser.role}'.`
        });
      }
      if (req.user.province && recipientUser.province !== req.user.province) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Recipient is outside your province.' });
      }
    }

    // Step 4: Insert distribution
    const distribution_id = await generateSequentialId('DIST-', 'reward_distributions', 'distribution_id');
    const insertResult = await client.query(`
      INSERT INTO reward_distributions
        (distribution_id, parent_allocation_id, distributed_by, recipient_user_id,
         recipient_shop_id, recipient_type, reward_type, reward_value, reward_description, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      distribution_id,
      parent_allocation_id,
      req.user.id,
      recipient_type !== 'shop' ? recipient_user_id : null,
      recipient_type === 'shop' ? recipient_shop_id : null,
      recipient_type,
      reward_type,
      reward_value,
      reward_description || null,
      notes || null
    ]);
    const distribution = insertResult.rows[0];

    // Step 5: Audit log
    const newTotal = alreadyDistributed + Number(reward_value);
    await client.query(`
      INSERT INTO reward_audit_logs (event_type, allocation_id, distribution_id, actor_id, detail)
      VALUES ('distributed', $1, $2, $3, $4)
    `, [allocation.id, distribution.id, req.user.id, JSON.stringify({
      distribution_id,
      recipient_type,
      reward_value: Number(reward_value),
      remaining_balance: (Number(allocation.reward_value) - newTotal).toFixed(2)
    })]);

    // Step 6: Mark allocation as distributed if fully allocated
    if (newTotal >= Number(allocation.reward_value)) {
      await client.query(
        `UPDATE reward_allocations SET status = 'distributed', updated_at = NOW() WHERE id = $1`,
        [allocation.id]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'Reward distributed successfully.', distribution });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('distributeReward error:', err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
};

/**
 * GET /api/rewards/distributions
 * ASM: what they distributed. FSM/SD: what they received. Admin/DM Team: all.
 */
const getDistributions = async (req, res) => {
  try {
    const role = req.user.role;
    const params = [];
    let where = '';

    if (role === 'area_sales_manager') {
      params.push(req.user.id);
      where = `WHERE rd.distributed_by = $1`;
    } else if (role === 'field_sales_manager' || role === 'sales_distributor') {
      params.push(req.user.id);
      where = `WHERE rd.recipient_user_id = $1`;
    }
    // admin/DM Team: no filter → all rows

    const result = await pool.query(`
      SELECT
        rd.*,
        ra.allocation_id AS allocation_ref,
        distributor.username AS distributed_by_username,
        distributor.employee_id AS distributed_by_employee_id,
        ru.username AS recipient_username,
        ru.employee_id AS recipient_employee_id,
        s.shop_name AS recipient_shop_name,
        s.shop_id AS recipient_shop_external_id
      FROM reward_distributions rd
      JOIN reward_allocations ra ON rd.parent_allocation_id = ra.id
      JOIN users distributor ON rd.distributed_by = distributor.id
      LEFT JOIN users ru ON rd.recipient_user_id = ru.id
      LEFT JOIN shops s ON rd.recipient_shop_id = s.id
      ${where}
      ORDER BY rd.created_at DESC
    `, params);

    res.json({ distributions: result.rows });
  } catch (err) {
    console.error('getDistributions error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * GET /api/rewards/my-rewards
 * Returns rewards received by the current user (distributions + allocations for ASM).
 */
const getMyRewards = async (req, res) => {
  try {
    // Distributions where this user is the recipient
    const distResult = await pool.query(`
      SELECT
        rd.*,
        ra.allocation_id AS allocation_ref,
        u.username AS distributed_by_username,
        u.employee_id AS distributed_by_employee_id
      FROM reward_distributions rd
      JOIN reward_allocations ra ON rd.parent_allocation_id = ra.id
      JOIN users u ON rd.distributed_by = u.id
      WHERE rd.recipient_user_id = $1
      ORDER BY rd.created_at DESC
    `, [req.user.id]);

    // If ASM, also include top-level allocations issued to them
    let allocations = [];
    if (req.user.role === 'area_sales_manager') {
      const allocResult = await pool.query(`
        SELECT
          ra.*,
          u.username AS issued_by_username,
          u.employee_id AS issued_by_employee_id,
          COALESCE(SUM(rd.reward_value), 0) AS total_distributed
        FROM reward_allocations ra
        JOIN users u ON ra.issued_by = u.id
        LEFT JOIN reward_distributions rd ON rd.parent_allocation_id = ra.id
        WHERE ra.recipient_id = $1
        GROUP BY ra.id, u.username, u.employee_id
        ORDER BY ra.created_at DESC
      `, [req.user.id]);
      allocations = allocResult.rows;
    }

    res.json({ distributions: distResult.rows, allocations });
  } catch (err) {
    console.error('getMyRewards error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * GET /api/rewards/audit
 * Full immutable event trail. Admin + DM Team only.
 */
const getRewardAudit = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        ral.id,
        ral.event_type,
        ral.detail,
        ral.created_at,
        u.username AS actor_username,
        u.role AS actor_role,
        u.employee_id AS actor_employee_id,
        ra.allocation_id AS allocation_ref,
        rd.distribution_id AS distribution_ref
      FROM reward_audit_logs ral
      JOIN users u ON ral.actor_id = u.id
      LEFT JOIN reward_allocations ra ON ral.allocation_id = ra.id
      LEFT JOIN reward_distributions rd ON ral.distribution_id = rd.id
      ORDER BY ral.created_at DESC
      LIMIT 500
    `);

    res.json({ audit_logs: result.rows });
  } catch (err) {
    console.error('getRewardAudit error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * POST /api/rewards/customer
 * DM Team issues a loyalty reward directly to a top customer (by mobile number).
 * Sends an SMS notification immediately after insertion.
 */
const issueCustomerReward = async (req, res) => {
  const { customer_mobile, reward_type, reward_value, reward_description } = req.body;

  if (!customer_mobile || !reward_type || !reward_description) {
    return res.status(400).json({ message: 'customer_mobile, reward_type, and reward_description are required.' });
  }
  if (reward_value != null && Number(reward_value) <= 0) {
    return res.status(400).json({ message: 'reward_value must be greater than 0 if provided.' });
  }

  try {
    // Verify this mobile belongs to a known customer (has at least one redemption)
    const customerCheck = await pool.query(
      'SELECT v.customer_mobile FROM vouchers v JOIN redemptions r ON v.claim_id = r.claim_id WHERE v.customer_mobile = $1 AND r.final_status = $2 LIMIT 1',
      [customer_mobile, 'redeemed']
    );
    if (customerCheck.rows.length === 0) {
      return res.status(400).json({ message: 'No redemption history found for this mobile number. Only customers with confirmed redemptions can be rewarded.' });
    }

    const reward_id = await generateSequentialId('CUST-', 'customer_rewards', 'reward_id');

    const insertResult = await pool.query(`
      INSERT INTO customer_rewards
        (reward_id, issued_by, customer_mobile, reward_type, reward_value, reward_description)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [reward_id, req.user.id, customer_mobile, reward_type, reward_value || null, reward_description]);

    const reward = insertResult.rows[0];

    // Send SMS notification to the customer
    const valueText = reward_value ? ` Reward value: LKR ${Number(reward_value).toLocaleString()}.` : '';
    const smsMessage = `Congratulations! You have been selected as a top loyal Nestle Connect customer.${valueText} Your reward: ${reward_description}. Reward ID: ${reward_id}. Contact your nearest shop for redemption.`;

    try {
      await sendSMS(customer_mobile, smsMessage, 'customer_reward', reward_id);
      await pool.query(
        `UPDATE customer_rewards SET status = 'notified', sms_sent = TRUE WHERE id = $1`,
        [reward.id]
      );
      reward.status = 'notified';
      reward.sms_sent = true;
    } catch (smsErr) {
      console.error('Customer reward SMS failed (reward still created):', smsErr.message);
    }

    // Audit log
    await pool.query(`
      INSERT INTO reward_audit_logs (event_type, actor_id, detail)
      VALUES ('customer_rewarded', $1, $2)
    `, [req.user.id, JSON.stringify({
      reward_id,
      customer_mobile,
      reward_type,
      reward_value: reward_value ? Number(reward_value) : null
    })]);

    res.status(201).json({ message: 'Customer reward issued successfully.', reward });
  } catch (err) {
    console.error('issueCustomerReward error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * GET /api/rewards/customer
 * DM Team: list all customer rewards issued.
 */
const getCustomerRewards = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        cr.*,
        u.username AS issued_by_username,
        u.employee_id AS issued_by_employee_id,
        (SELECT COUNT(*) FROM vouchers v
         JOIN redemptions r ON v.claim_id = r.claim_id
         WHERE v.customer_mobile = cr.customer_mobile AND r.final_status = 'redeemed'
        ) AS customer_total_redemptions
      FROM customer_rewards cr
      JOIN users u ON cr.issued_by = u.id
      ORDER BY cr.created_at DESC
    `);
    res.json({ customer_rewards: result.rows });
  } catch (err) {
    console.error('getCustomerRewards error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * GET /api/rewards/customer/:mobile
 * DM Team: reward history + redemption profile for a specific customer mobile.
 */
const getCustomerRewardHistory = async (req, res) => {
  const { mobile } = req.params;
  try {
    const [rewardsResult, analyticsResult] = await Promise.all([
      pool.query(`
        SELECT cr.*, u.username AS issued_by_username
        FROM customer_rewards cr
        JOIN users u ON cr.issued_by = u.id
        WHERE cr.customer_mobile = $1
        ORDER BY cr.created_at DESC
      `, [mobile]),
      pool.query(`
        SELECT
          COUNT(*) AS total_redemptions,
          MIN(r.redeemed_at) AS first_redemption,
          MAX(r.redeemed_at) AS last_redemption,
          COUNT(DISTINCT r.shop_id) AS unique_shops
        FROM redemptions r
        JOIN vouchers v ON r.claim_id = v.claim_id
        WHERE v.customer_mobile = $1 AND r.final_status = 'redeemed'
      `, [mobile])
    ]);

    res.json({
      customer_mobile: mobile,
      analytics: analyticsResult.rows[0],
      rewards: rewardsResult.rows
    });
  } catch (err) {
    console.error('getCustomerRewardHistory error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  allocateReward,
  getAllocations,
  distributeReward,
  getDistributions,
  getMyRewards,
  getRewardAudit,
  issueCustomerReward,
  getCustomerRewards,
  getCustomerRewardHistory
};
