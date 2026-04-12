const pool = require('../config/db');
const bcrypt = require('bcrypt');

const getAllUsers = async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, role, created_at FROM users ORDER BY created_at DESC');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('getAllUsers error:', error);
    res.status(500).json({ message: 'Server error while fetching users' });
  }
};

const createUser = async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !role) {
    return res.status(400).json({ message: 'Username, password, and role are required' });
  }
  if (!['admin', 'rep'].includes(role)) {
    return res.status(400).json({ message: 'Invalid role' });
  }
  try {
    const existing = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ message: 'Username already exists' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query('INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)', [username, hashedPassword, role]);
    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    console.error('createUser error:', error);
    res.status(500).json({ message: 'Server error while creating user' });
  }
};

const deleteUser = async (req, res) => {
  const { id } = req.params;
  try {
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

module.exports = { getAllUsers, createUser, deleteUser };