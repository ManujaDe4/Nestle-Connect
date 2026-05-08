const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const pool = require('../config/db');
const { logActivity } = require('../controllers/activityController');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is not set. Add it to backend/.env');
  process.exit(1);
}

const authenticate = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'Access denied' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};

const authorize = (roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      message: `Forbidden: Access restricted. Your role is '${req.user.role}' but this action requires one of: ${roles.join(', ')}.`
    });
  }
  next();
};

const login = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password required' });
  }
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1 OR employee_id = $1',
      [username]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        province: user.province || null,
        region: user.region || null,
        area: user.area || null
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    await logActivity({
      userId: user.id,
      action: 'login',
      detail: `User ${user.username} logged in as ${user.role}`
    });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        employee_id: user.employee_id || null,
        role: user.role,
        province: user.province || null,
        region: user.region || null,
        area: user.area || null
      }
    });
  } catch (err) {
    console.error('login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { authenticate, authorize, login };
