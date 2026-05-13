const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const { query } = require('../lib/db');

const slugify = (text) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const createBusiness = async (req, res) => {
  const { name, description, cityId, category, address, phone, website, googleMapsUrl } = req.body;

  if (!name || !cityId) return res.status(400).json({ error: 'name and cityId are required' });

  const existing = await query('SELECT id FROM businesses WHERE owner_id = $1 AND is_active = true', [req.user.id]);
  if (existing.rows.length) {
    return res.status(409).json({ error: 'You already have an active business' });
  }

  const businessId = uuidv4();
  let slug = slugify(name);

  const slugConflict = await query('SELECT id FROM businesses WHERE slug = $1', [slug]);
  if (slugConflict.rows.length) slug = `${slug}-${businessId.slice(0, 6)}`;

  const subId = uuidv4();
  await query(
    `INSERT INTO subscriptions (id, business_id, plan, price_monthly, max_challenges, max_staff, status, current_period_end)
     VALUES ($1, $2, 'free', 0, 1, 1, 'active', NOW() + INTERVAL '100 years')`,
    [subId, businessId]
  );

  const frontendUrl = (process.env.FRONTEND_URL || 'https://achievo.app').split(',').find(u => !u.includes('localhost')) || process.env.FRONTEND_URL || 'https://achievo.app';
  const qrData = `${frontendUrl}/b/${slug}`;
  const qrCodeUrl = await QRCode.toDataURL(qrData);

  const { rows } = await query(
    `INSERT INTO businesses (id, name, slug, description, city_id, category, address, phone, website, google_maps_url, qr_code_url, owner_id, subscription_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING *`,
    [businessId, name, slug, description || null, cityId, category || 'other', address || null,
     phone || null, website || null, googleMapsUrl || null, qrCodeUrl, req.user.id, subId]
  );

  await query('UPDATE subscriptions SET business_id = $1 WHERE id = $2', [businessId, subId]);

  res.status(201).json(rows[0]);
};

const getMyBusiness = async (req, res) => {
  const { rows } = await query(
    `SELECT b.*, s.plan, s.max_challenges, s.max_staff, s.status as sub_status, s.trial_ends_at
     FROM businesses b
     LEFT JOIN subscriptions s ON s.id = b.subscription_id
     WHERE b.owner_id = $1 AND b.is_active = true`,
    [req.user.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'No business found' });
  res.json(rows[0]);
};

const getBusinessBySlug = async (req, res) => {
  const { slug } = req.params;
  const { rows } = await query(
    `SELECT b.id, b.name, b.slug, b.description, b.category, b.address, b.phone, b.website,
            b.google_maps_url, b.logo_url, b.cover_url, c.name as city_name, c.slug as city_slug
     FROM businesses b
     JOIN cities c ON c.id = b.city_id
     WHERE b.slug = $1 AND b.is_active = true`,
    [slug]
  );
  if (!rows.length) return res.status(404).json({ error: 'Business not found' });

  const { rows: challenges } = await query(
    `SELECT id, title, description, type, reward_title, reward_description, reward_type,
            discount_percent, points_value, max_completions, expires_at
     FROM challenges
     WHERE business_id = $1 AND is_active = true
     ORDER BY created_at DESC`,
    [rows[0].id]
  );

  res.json({ ...rows[0], challenges });
};

const getBusinessesByCity = async (req, res) => {
  const { citySlug } = req.params;
  const { category, search } = req.query;

  let sql = `
    SELECT b.id, b.name, b.slug, b.description, b.category, b.address, b.logo_url,
           ci.name as city_name, ci.country,
           COUNT(c.id) as challenge_count
    FROM businesses b
    JOIN cities ci ON ci.id = b.city_id AND ci.slug = $1
    LEFT JOIN challenges c ON c.business_id = b.id AND c.is_active = true
    WHERE b.is_active = true
  `;
  const params = [citySlug];

  if (category) {
    params.push(category);
    sql += ` AND b.category = $${params.length}`;
  }
  if (search) {
    params.push(`%${search}%`);
    sql += ` AND b.name ILIKE $${params.length}`;
  }

  sql += ' GROUP BY b.id, ci.name, ci.country ORDER BY challenge_count DESC, b.created_at DESC';

  const { rows } = await query(sql, params);
  res.json(rows);
};

const getAllBusinesses = async (req, res) => {
  const { category, search } = req.query;

  let sql = `
    SELECT b.id, b.name, b.slug, b.description, b.category, b.address, b.logo_url,
           ci.name as city_name, ci.country,
           COUNT(c.id) as challenge_count
    FROM businesses b
    JOIN cities ci ON ci.id = b.city_id
    LEFT JOIN challenges c ON c.business_id = b.id AND c.is_active = true
    WHERE b.is_active = true
  `;
  const params = [];

  if (category) {
    params.push(category);
    sql += ` AND b.category = $${params.length}`;
  }
  if (search) {
    params.push(`%${search}%`);
    sql += ` AND (b.name ILIKE $${params.length} OR ci.name ILIKE $${params.length})`;
  }

  sql += ' GROUP BY b.id, ci.name, ci.country ORDER BY challenge_count DESC, b.created_at DESC LIMIT 100';

  const { rows } = await query(sql, params);
  res.json(rows);
};

const updateBusiness = async (req, res) => {
  const { id } = req.params;
  const { name, description, category, address, phone, website, googleMapsUrl, logoUrl, coverUrl } = req.body;

  const { rows: owned } = await query('SELECT id FROM businesses WHERE id = $1 AND owner_id = $2', [id, req.user.id]);
  if (!owned.length) return res.status(403).json({ error: 'Forbidden' });

  const { rows } = await query(
    `UPDATE businesses SET
       name = COALESCE($1, name),
       description = COALESCE($2, description),
       category = COALESCE($3, category),
       address = COALESCE($4, address),
       phone = COALESCE($5, phone),
       website = COALESCE($6, website),
       google_maps_url = COALESCE($7, google_maps_url),
       logo_url = COALESCE($8, logo_url),
       cover_url = COALESCE($9, cover_url)
     WHERE id = $10 RETURNING *`,
    [name, description, category, address, phone, website, googleMapsUrl, logoUrl, coverUrl, id]
  );
  res.json(rows[0]);
};

const getQRCode = async (req, res) => {
  const { id } = req.params;
  const { rows } = await query('SELECT slug, qr_code_url FROM businesses WHERE id = $1', [id]);
  if (!rows.length) return res.status(404).json({ error: 'Business not found' });

  if (rows[0].qr_code_url) return res.json({ qrCodeUrl: rows[0].qr_code_url });

  const frontendUrl = (process.env.FRONTEND_URL || 'https://achievo.app').split(',').find(u => !u.includes('localhost')) || process.env.FRONTEND_URL || 'https://achievo.app';
  const qrCodeUrl = await QRCode.toDataURL(`${frontendUrl}/b/${rows[0].slug}`);
  await query('UPDATE businesses SET qr_code_url = $1 WHERE id = $2', [qrCodeUrl, id]);
  res.json({ qrCodeUrl });
};

module.exports = { createBusiness, getMyBusiness, getBusinessBySlug, getBusinessesByCity, getAllBusinesses, updateBusiness, getQRCode };
