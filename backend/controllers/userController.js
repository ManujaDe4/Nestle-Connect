const pool = require('../config/db');
const bcrypt = require('bcrypt');
const { getLocationPrefix } = require('../utils/locationCodes');

const getMyProfile = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, employee_id, role, province, region, area, created_at FROM users WHERE id = $1',
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

    // If changing password, verify current first
    if (new_password) {
      if (!current_password) return res.status(400).json({ message: 'Current password is required' });
      const match = await bcrypt.compare(current_password, user.password_hash);
      if (!match) return res.status(400).json({ message: 'Current password is incorrect' });
      const hashed = await bcrypt.hash(new_password, 10);
      await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashed, req.user.id]);
    }

    // Update display name if provided (stored in username field for simplicity)
    if (display_name && display_name !== user.username) {
      const existing = await pool.query('SELECT id FROM users WHERE username = $1 AND id != $2', [display_name, req.user.id]);
      if (existing.rows.length > 0) return res.status(409).json({ message: 'That name is already taken' });
      await pool.query('UPDATE users SET username = $1 WHERE id = $2', [display_name, req.user.id]);
    }

    const updated = await pool.query(
      'SELECT id, username, employee_id, role, province, region, area, created_at FROM users WHERE id = $1',
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
    const result = await pool.query('SELECT id, username, employee_id, role, province, region, area, created_at FROM users ORDER BY created_at DESC');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('getAllUsers error:', error);
    res.status(500).json({ message: 'Server error while fetching users' });
  }
};

const createUser = async (req, res) => {
  const { username, password, role, province, region, area } = req.body;
  if (!username || !password || !role) {
    return res.status(400).json({ message: 'Username, password, and role are required' });
  }
  if (!['admin', 'sales_distributor'].includes(role)) {
    return res.status(400).json({ message: 'Invalid role' });
  }
  try {
    let newEmployeeId = null;

    if (role === 'sales_distributor') {
      const locPrefix = getLocationPrefix(province, region);
      const sdPrefix = `SD-${locPrefix}-`;
      
      // Find the latest SD ID for THIS specific prefix
      const lastSD = await pool.query("SELECT employee_id FROM users WHERE employee_id LIKE $1 ORDER BY employee_id DESC LIMIT 1", [`${sdPrefix}%`]);
      let nextNum = 1;
      if (lastSD.rows.length > 0) {
        const lastId = lastSD.rows[0].employee_id;
        const numPart = lastId.replace(sdPrefix, '');
        nextNum = parseInt(numPart, 10) + 1;
      }
      newEmployeeId = `${sdPrefix}${String(nextNum).padStart(6, '0')}`;
    }

    const existing = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ message: 'Username already exists' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO users (username, password_hash, role, employee_id, province, region, area) VALUES ($1, $2, $3, $4, $5, $6, $7)', 
      [username, hashedPassword, role, newEmployeeId, province || null, region || null, area || null]
    );
    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    console.error('createUser error:', error);
    res.status(500).json({ message: 'Server error while creating user' });
  }
};

const deleteUser = async (req, res) => {
  const { id } = req.params;
  try {
    // Delete activity logs referencing this user first
    await pool.query('DELETE FROM activity_logs WHERE user_id = $1', [id]);
    
    // Nullify references in shops to prevent FK violations
    await pool.query('UPDATE shops SET rep_id = NULL, created_by_rep_id = NULL WHERE rep_id = $1 OR created_by_rep_id = $1', [id]);
    
    const result = await pool.query('DELETE FROM users WHERE id = $1 AND role != $2', [id, 'admin']); // Prevent deleting admins
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'User not found or cannot delete' });
    }
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('deleteUser error:', error);
    res.status(500).json({ message: 'Server error while deleting user' });
  }
};

module.exports = { getAllUsers, createUser, deleteUser, getMyProfile, updateMyProfile };