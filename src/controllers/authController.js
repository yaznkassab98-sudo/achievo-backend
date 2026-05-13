const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../lib/db');

const signToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '15m' });

const signRefreshToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' });

const signup = async (req, res) => {
  const { email, password, fullName, role, cityId, phone } = req.body;

  if (!email || !password || !fullName || !role) {
    return res.status(400).json({ error: 'email, password, fullName, and role are required' });
  }
  if (!['customer', 'business_owner'].includes(role)) {
    return res.status(400).json({ error: 'role must be customer or business_owner' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (existing.rows.length) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const { rows } = await query(
    `INSERT INTO users (id, email, password_hash, full_name, role, city_id, phone)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, email, full_name, role, city_id, total_points, created_at`,
    [uuidv4(), email.toLowerCase(), passwordHash, fullName, role, cityId || null, phone || null]
  );

  const user = rows[0];
  const token = signToken(user.id);
  const refreshToken = signRefreshToken(user.id);

  res.status(201).json({ token, refreshToken, user });
};

const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const { rows } = await query(
    'SELECT id, email, password_hash, full_name, role, city_id, total_points FROM users WHERE email = $1',
    [email.toLowerCase()]
  );

  if (!rows.length) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const user = rows[0];
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const { password_hash, ...safeUser } = user;
  const token = signToken(user.id);
  const refreshToken = signRefreshToken(user.id);

  res.json({ token, refreshToken, user: safeUser });
};

const refresh = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'refreshToken required' });

  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const { rows } = await query('SELECT id FROM users WHERE id = $1', [payload.userId]);
    if (!rows.length) return res.status(401).json({ error: 'User not found' });

    const token = signToken(payload.userId);
    res.json({ token });
  } catch {
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
};

const me = async (req, res) => {
  const { rows } = await query(
    'SELECT id, email, full_name, role, city_id, total_points, avatar_url, phone, is_verified, created_at FROM users WHERE id = $1',
    [req.user.id]
  );
  res.json(rows[0]);
};

const updateProfile = async (req, res) => {
  const { fullName, phone, cityId } = req.body;
  if (!fullName) return res.status(400).json({ error: 'fullName is required' });

  const { rows } = await query(
    `UPDATE users SET
       full_name = $1,
       phone = COALESCE($2, phone),
       city_id = COALESCE($3, city_id)
     WHERE id = $4
     RETURNING id, email, full_name, role, city_id, total_points, phone, avatar_url`,
    [fullName, phone || null, cityId || null, req.user.id]
  );
  res.json(rows[0]);
};

module.exports = { signup, login, refresh, me, updateProfile };
