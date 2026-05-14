const { v4: uuidv4 } = require('uuid');
const { query } = require('../lib/db');

const getStats = async (req, res) => {
  const [users, businesses, completions, cities, points] = await Promise.all([
    query(`SELECT COUNT(*) as count, COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as new_this_week FROM users`),
    query(`SELECT COUNT(*) as count, COUNT(*) FILTER (WHERE is_active = true) as active FROM businesses`),
    query(`SELECT COUNT(*) as count, COUNT(*) FILTER (WHERE status IN ('confirmed','claimed')) as confirmed FROM completions`),
    query(`SELECT COUNT(*) as count FROM cities WHERE is_active = true`),
    query(`SELECT COALESCE(SUM(total_points), 0) as total FROM users`),
  ]);
  res.json({
    users: users.rows[0],
    businesses: businesses.rows[0],
    completions: completions.rows[0],
    cities: cities.rows[0],
    points_awarded: points.rows[0].total,
  });
};

const getRecentActivity = async (req, res) => {
  const [recentBizs, recentUsers] = await Promise.all([
    query(
      `SELECT b.id, b.name, b.slug, b.category, b.is_active, b.created_at,
              u.full_name as owner_name, u.email as owner_email,
              ci.name as city_name,
              s.plan
       FROM businesses b
       JOIN users u ON u.id = b.owner_id
       JOIN cities ci ON ci.id = b.city_id
       LEFT JOIN subscriptions s ON s.id = b.subscription_id
       ORDER BY b.created_at DESC LIMIT 5`
    ),
    query(
      `SELECT id, full_name, email, role, total_points, is_verified, created_at
       FROM users ORDER BY created_at DESC LIMIT 5`
    ),
  ]);
  res.json({ businesses: recentBizs.rows, users: recentUsers.rows });
};

const getBusinesses = async (req, res) => {
  const { search, page = 1 } = req.query;
  const offset = (parseInt(page) - 1) * 50;
  let sql = `
    SELECT b.id, b.name, b.slug, b.category, b.is_active, b.created_at,
           u.full_name as owner_name, u.email as owner_email,
           ci.name as city_name, ci.country,
           s.plan,
           COUNT(DISTINCT ch.id) as challenge_count,
           COUNT(DISTINCT co.id) FILTER (WHERE co.status IN ('confirmed','claimed')) as completion_count
    FROM businesses b
    JOIN users u ON u.id = b.owner_id
    JOIN cities ci ON ci.id = b.city_id
    LEFT JOIN subscriptions s ON s.id = b.subscription_id
    LEFT JOIN challenges ch ON ch.business_id = b.id AND ch.is_active = true
    LEFT JOIN completions co ON co.business_id = b.id
  `;
  const params = [];
  if (search) {
    params.push(`%${search}%`);
    sql += ` WHERE (b.name ILIKE $1 OR u.email ILIKE $1 OR ci.name ILIKE $1)`;
  }
  sql += ` GROUP BY b.id, u.full_name, u.email, ci.name, ci.country, s.plan ORDER BY b.created_at DESC LIMIT 50 OFFSET $${params.length + 1}`;
  params.push(offset);
  const { rows } = await query(sql, params);
  res.json(rows);
};

const toggleBusiness = async (req, res) => {
  const { id } = req.params;
  const { rows } = await query(
    `UPDATE businesses SET is_active = NOT is_active WHERE id = $1 RETURNING id, name, is_active`,
    [id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Business not found' });
  res.json(rows[0]);
};

const getUsers = async (req, res) => {
  const { search, page = 1 } = req.query;
  const offset = (parseInt(page) - 1) * 50;
  let sql = `
    SELECT u.id, u.full_name, u.email, u.role, u.total_points, u.is_verified, u.created_at,
           ci.name as city_name,
           COUNT(co.id) FILTER (WHERE co.status IN ('confirmed','claimed')) as completion_count
    FROM users u
    LEFT JOIN cities ci ON ci.id = u.city_id
    LEFT JOIN completions co ON co.user_id = u.id
  `;
  const params = [];
  if (search) {
    params.push(`%${search}%`);
    sql += ` WHERE (u.full_name ILIKE $1 OR u.email ILIKE $1)`;
  }
  sql += ` GROUP BY u.id, ci.name ORDER BY u.created_at DESC LIMIT 50 OFFSET $${params.length + 1}`;
  params.push(offset);
  const { rows } = await query(sql, params);
  res.json(rows);
};

const verifyUser = async (req, res) => {
  const { id } = req.params;
  const { rows } = await query(
    `UPDATE users SET is_verified = true WHERE id = $1 RETURNING id, full_name, is_verified`,
    [id]
  );
  if (!rows.length) return res.status(404).json({ error: 'User not found' });
  res.json(rows[0]);
};

const getCities = async (req, res) => {
  const { rows } = await query(
    `SELECT ci.*, COUNT(b.id) as business_count
     FROM cities ci
     LEFT JOIN businesses b ON b.city_id = ci.id AND b.is_active = true
     GROUP BY ci.id ORDER BY ci.country, ci.name`
  );
  res.json(rows);
};

const createCity = async (req, res) => {
  const { name, country, slug } = req.body;
  if (!name || !country || !slug) return res.status(400).json({ error: 'name, country, and slug are required' });
  const { rows } = await query(
    `INSERT INTO cities (id, name, country, slug) VALUES ($1,$2,$3,$4) RETURNING *`,
    [uuidv4(), name, country, slug.toLowerCase().replace(/[^a-z0-9-]/g, '-')]
  );
  res.status(201).json(rows[0]);
};

const updateCity = async (req, res) => {
  const { id } = req.params;
  const { name, country, latitude, longitude } = req.body;
  const { rows } = await query(
    `UPDATE cities SET
       name = COALESCE($1, name),
       country = COALESCE($2, country),
       latitude = COALESCE($3, latitude),
       longitude = COALESCE($4, longitude)
     WHERE id = $5 RETURNING *`,
    [name || null, country || null, latitude || null, longitude || null, id]
  );
  if (!rows.length) return res.status(404).json({ error: 'City not found' });
  res.json(rows[0]);
};

const toggleCity = async (req, res) => {
  const { id } = req.params;
  const { rows } = await query(
    `UPDATE cities SET is_active = NOT is_active WHERE id = $1 RETURNING id, name, is_active`,
    [id]
  );
  if (!rows.length) return res.status(404).json({ error: 'City not found' });
  res.json(rows[0]);
};

const getDailyChart = async (req, res) => {
  const { rows } = await query(
    `SELECT DATE(created_at AT TIME ZONE 'UTC') as date,
            TO_CHAR(created_at AT TIME ZONE 'UTC', 'Mon DD') as label,
            COUNT(*) FILTER (WHERE role = 'customer') as customers,
            COUNT(*) FILTER (WHERE role = 'business_owner') as owners
     FROM users
     WHERE created_at > NOW() - INTERVAL '30 days'
     GROUP BY date ORDER BY date ASC`
  );
  res.json(rows);
};

module.exports = { getStats, getRecentActivity, getBusinesses, toggleBusiness, getUsers, verifyUser, getCities, createCity, updateCity, toggleCity, getDailyChart };
