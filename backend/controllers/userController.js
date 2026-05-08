const pool = require('../config/db');
const bcrypt = require('bcrypt');
const { getLocationPrefix } = require('../utils/locationCodes');

const STAFF_ROLES = [
  'admin', 'sys_admin', 'sales_distributor',
  'digital_marketing_manager', 'digital_content_specialist',
  'digital_media_performance_manager', 'social_media_influencer_strategist',
  'crm_data_analyst', 'digital_marketing_intern'
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
    const result = await pool.query(
      'SELECT id, username, employee_id, role, province, region, area, permissions, created_at FROM users ORDER BY created_at DESC'
    );
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
  try {
    let newEmployeeId = null;
    if (role === 'sales_distributor') {
      const locPrefix = getLocationPrefix(province, region);
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
    const finalPermissions = permissions || DEFAULT_PERMISSIONS[role] || {};

    await pool.query(
      'INSERT INTO users (username, password_hash, role, employee_id, province, region, area, permissions) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [username, hashedPassword, role, newEmployeeId, province || null, region || null, area || null, JSON.stringify(finalPermissions)]
    );
    res.status(201).json({ message: 'User created successfully', employee_id: newEmployeeId });
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
