const pool = require('../config/db');
const bcrypt = require('bcrypt');
const { getLocationPrefix } = require('../utils/locationCodes');

const STAFF_ROLES = [
  'admin', 'sys_admin', 'sales_distributor',
  'digital_marketing_manager', 'digital_content_specialist',
  'digital_media_performance_manager', 'social_media_influencer_strategist',
  'crm_data_analyst', 'digital_marketing_intern',
  'area_sales_manager', 'field_sales_manager'
];

const ROLE_LABELS = {
  admin: 'System Administrator',
  sys_admin: 'System Administrator',
  sales_distributor: 'Sales Distributor',
  digital_marketing_manager: 'Digital Marketing Manager',
  digital_content_specialist: 'Digital Content Specialist',
  digital_media_performance_manager: 'Digital Media & Performance Manager',
  social_media_influencer_strategist: 'Social Media & Influencer Strategist',
  crm_data_analyst: 'CRM & Data Analyst',
  digital_marketing_intern: 'Digital Marketing Intern',
  area_sales_manager: 'Area Sales Manager',
  field_sales_manager: 'Field Sales Manager',
};

const ROLE_PREFIXES = {
  admin: 'SYS-',
  sys_admin: 'SYS-',
  digital_marketing_manager: 'DMM-',
  digital_content_specialist: 'DCS-',
  digital_media_performance_manager: 'DMPM-',
  social_media_influencer_strategist: 'SMIS-',
  crm_data_analyst: 'CDA-',
  digital_marketing_intern: 'DMI-',
  area_sales_manager: 'ASM-',
  field_sales_manager: 'FSM-',
};

const DEFAULT_PERMISSIONS = {
  admin: { users: true, shops: true, activity: true, campaigns: true, stats: true, roi: true },
  sys_admin: { users: true, shops: true, activity: true, campaigns: true, stats: true, roi: true },
  digital_marketing_manager: { users: false, shops: true, activity: true, campaigns: true, stats: true, roi: true },
  digital_content_specialist: { users: false, shops: false, activity: false, campaigns: true, stats: true, roi: false },
  digital_media_performance_manager: { users: false, shops: false, activity: false, campaigns: true, stats: true, roi: true },
  social_media_influencer_strategist: { users: false, shops: false, activity: false, campaigns: true, stats: false, roi: false },
  crm_data_analyst: { users: false, shops: true, activity: true, campaigns: false, stats: true, roi: true },
  digital_marketing_intern: { users: false, shops: false, activity: false, campaigns: false, stats: true, roi: false },
  sales_distributor: { users: false, shops: false, activity: false, campaigns: false, stats: false, roi: false },
  // Field management roles — territory-scoped; permissions fixed (not editable per-user)
  area_sales_manager: { users: true, shops: true, activity: true, campaigns: false, stats: true, roi: false },
  field_sales_manager: { users: true, shops: true, activity: true, campaigns: false, stats: true, roi: false },
};

// Roles that can manage Field Reps (territory-scoped)
const FIELD_MANAGERS = ['area_sales_manager', 'field_sales_manager'];

// What each field manager role is allowed to create
const CREATABLE_ROLES = {
  area_sales_manager: ['field_sales_manager', 'sales_distributor'],
  field_sales_manager: ['sales_distributor'],
};

async function nextEmployeeId(prefix) {
  const last = await pool.query(
    "SELECT employee_id FROM users WHERE employee_id LIKE $1 ORDER BY employee_id DESC LIMIT 1",
    [`${prefix}%`]
  );
  let nextNum = 1;
  if (last.rows.length > 0 && last.rows[0].employee_id) {
    const numPart = last.rows[0].employee_id.replace(prefix, '');
    const parsed = parseInt(numPart, 10);
    if (!Number.isNaN(parsed)) nextNum = parsed + 1;
  }
  return `${prefix}${String(nextNum).padStart(6, '0')}`;
}

const getMyProfile = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, employee_id, role, province, region, area, permissions, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'User not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('getMyProfile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const updateMyProfile = async (req, res) => {
  const { display_name, current_password, new_password } = req.body;
  try {
    const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    if (userRes.rows.length === 0) return res.status(404).json({ message: 'User not found' });
    const user = userRes.rows[0];

    if (new_password) {
      if (!current_password) return res.status(400).json({ message: 'Current password is required' });
      const match = await bcrypt.compare(current_password, user.password_hash);
      if (!match) return res.status(400).json({ message: 'Current password is incorrect' });
      const hashed = await bcrypt.hash(new_password, 10);
      await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashed, req.user.id]);
    }

    if (display_name && display_name !== user.username) {
      const existing = await pool.query('SELECT id FROM users WHERE username = $1 AND id != $2', [display_name, req.user.id]);
      if (existing.rows.length > 0) return res.status(409).json({ message: 'That name is already taken' });
      await pool.query('UPDATE users SET username = $1 WHERE id = $2', [display_name, req.user.id]);
    }

    const updated = await pool.query(
      'SELECT id, username, employee_id, role, province, region, area, permissions, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    res.json({ message: 'Profile updated successfully', user: updated.rows[0] });
  } catch (error) {
    console.error('updateMyProfile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const { role, province, region } = req.user;
    let query, params;

    if (role === 'area_sales_manager') {
      // ASMs see FSMs and Sales Distributors in their province only
      query = `SELECT id, username, employee_id, role, province, region, area, permissions, created_at
               FROM users
               WHERE province = $1
                 AND role IN ('field_sales_manager', 'sales_distributor')
               ORDER BY created_at DESC`;
      params = [province];
    } else if (role === 'field_sales_manager') {
      // FSMs see Sales Distributors in their province + region only
      query = `SELECT id, username, employee_id, role, province, region, area, permissions, created_at
               FROM users
               WHERE province = $1 AND region = $2
                 AND role = 'sales_distributor'
               ORDER BY created_at DESC`;
      params = [province, region];
    } else {
      // Admins/sys_admin/digital team see everyone
      query = 'SELECT id, username, employee_id, role, province, region, area, permissions, created_at FROM users ORDER BY created_at DESC';
      params = [];
    }

    const result = await pool.query(query, params);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('getAllUsers error:', error);
    res.status(500).json({ message: 'Server error while fetching users' });
  }
};

const createUser = async (req, res) => {
  const { username, password, role, province, region, area, permissions } = req.body;
  if (!username || !password || !role) {
    return res.status(400).json({ message: 'Username, password, and role are required' });
  }
  if (!STAFF_ROLES.includes(role)) {
    return res.status(400).json({ message: 'Invalid role' });
  }

  // Territory-scoped creation enforcement for field managers
  const requesterRole = req.user.role;
  if (FIELD_MANAGERS.includes(requesterRole)) {
    const allowed = CREATABLE_ROLES[requesterRole] || [];
    if (!allowed.includes(role)) {
      return res.status(403).json({
        message: `Your role (${ROLE_LABELS[requesterRole]}) cannot create users with role '${ROLE_LABELS[role] || role}'.`
      });
    }
  }

  try {
    let finalProvince = province || null;
    let finalRegion = region || null;
    let finalArea = area || null;

    // FSMs can only create reps in their own territory
    if (requesterRole === 'field_sales_manager') {
      finalProvince = req.user.province;
      finalRegion = req.user.region;
    }
    // ASMs can only create within their own province
    if (requesterRole === 'area_sales_manager') {
      finalProvince = req.user.province;
    }

    let newEmployeeId = null;
    if (role === 'sales_distributor') {
      const locPrefix = getLocationPrefix(finalProvince, finalRegion);
      newEmployeeId = await nextEmployeeId(`SD-${locPrefix}-`);
    } else {
      const prefix = ROLE_PREFIXES[role] || 'USR-';
      newEmployeeId = await nextEmployeeId(prefix);
    }

    const existing = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    // For field managers, use fixed DEFAULT_PERMISSIONS (not editable per-user via UI)
    const finalPermissions = FIELD_MANAGERS.includes(role)
      ? DEFAULT_PERMISSIONS[role]
      : (permissions || DEFAULT_PERMISSIONS[role] || {});

    await pool.query(
      'INSERT INTO users (username, password_hash, role, employee_id, province, region, area, permissions) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [username, hashedPassword, role, newEmployeeId, finalProvince, finalRegion, finalArea, JSON.stringify(finalPermissions)]
    );
    res.status(201).json({ message: 'User created successfully', employee_id: newEmployeeId, role_label: ROLE_LABELS[role] || role });
  } catch (error) {
    console.error('createUser error:', error);
    res.status(500).json({ message: 'Server error while creating user' });
  }
};

const updateUserPermissions = async (req, res) => {
  const { id } = req.params;
  const { permissions } = req.body;
  if (!permissions || typeof permissions !== 'object') {
    return res.status(400).json({ message: 'Permissions object is required' });
  }
  try {
    const result = await pool.query(
      'UPDATE users SET permissions = $1 WHERE id = $2 AND role != $3 RETURNING id, username, role, permissions',
      [JSON.stringify(permissions), id, 'admin']
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'User not found or cannot modify admin permissions' });
    }
    res.json({ message: 'Permissions updated successfully', user: result.rows[0] });
  } catch (error) {
    console.error('updateUserPermissions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteUser = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM activity_logs WHERE user_id = $1', [id]);
    await pool.query('UPDATE shops SET rep_id = NULL, created_by_rep_id = NULL WHERE rep_id = $1 OR created_by_rep_id = $1', [id]);
    const result = await pool.query('DELETE FROM users WHERE id = $1 AND role != $2', [id, 'admin']);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'User not found or cannot delete' });
    }
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('deleteUser error:', error);
    res.status(500).json({ message: 'Server error while deleting user' });
  }
};

module.exports = { getAllUsers, createUser, deleteUser, getMyProfile, updateMyProfile, updateUserPermissions, ROLE_LABELS };
