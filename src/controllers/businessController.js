const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const { query } = require('../lib/db');
const { geocodeAddress } = require('../lib/geocode');

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

  let lat = null, lng = null;
  if (address) {
    const { rows: cityRows } = await query('SELECT name, country FROM cities WHERE id = $1', [cityId]);
    const coords = await geocodeAddress(address, cityRows[0]?.name, cityRows[0]?.country);
    if (coords) { lat = coords.lat; lng = coords.lng; }
  }

  const { rows } = await query(
    `INSERT INTO businesses (id, name, slug, description, city_id, category, address, phone, website, google_maps_url, qr_code_url, owner_id, subscription_id, latitude, longitude)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING *`,
    [businessId, name, slug, description || null, cityId, category || 'other', address || null,
     phone || null, website || null, googleMapsUrl || null, qrCodeUrl, req.user.id, subId, lat, lng]
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
            b.google_maps_url, b.logo_url, b.cover_url, c.name as city_name, c.slug as city_slug,
            (SELECT COUNT(*) FROM completions co JOIN challenges ch ON ch.id = co.challenge_id WHERE ch.business_id = b.id AND co.status IN ('confirmed','claimed') AND co.updated_at > NOW() - INTERVAL '7 days') as weekly_completions,
            (SELECT COUNT(*) FROM completions co JOIN challenges ch ON ch.id = co.challenge_id WHERE ch.business_id = b.id AND co.status IN ('confirmed','claimed')) as total_completions
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
           b.latitude, b.longitude,
           ci.name as city_name, ci.slug as city_slug, ci.country,
           COUNT(c.id) as challenge_count,
           COALESCE(SUM(c.points_value), 0) as total_points,
           (SELECT reward_title FROM challenges WHERE business_id = b.id AND is_active = true ORDER BY points_value DESC LIMIT 1) as best_reward_title,
           (SELECT points_value FROM challenges WHERE business_id = b.id AND is_active = true ORDER BY points_value DESC LIMIT 1) as best_reward_points,
           (SELECT COUNT(*) FROM completions co JOIN challenges ch ON ch.id = co.challenge_id WHERE ch.business_id = b.id AND co.status IN ('confirmed','claimed') AND co.updated_at > NOW() - INTERVAL '7 days') as weekly_completions,
           (SELECT COUNT(*) FROM completions co JOIN challenges ch ON ch.id = co.challenge_id WHERE ch.business_id = b.id AND co.status IN ('confirmed','claimed')) as total_completions
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

  sql += ' GROUP BY b.id, ci.name, ci.slug, ci.country ORDER BY challenge_count DESC, b.created_at DESC';

  const { rows } = await query(sql, params);
  res.json(rows);
};

const getAllBusinesses = async (req, res) => {
  const { category, search, country } = req.query;

  let sql = `
    SELECT b.id, b.name, b.slug, b.description, b.category, b.address, b.logo_url,
           b.latitude, b.longitude,
           ci.name as city_name, ci.slug as city_slug, ci.country,
           COUNT(c.id) as challenge_count,
           COALESCE(SUM(c.points_value), 0) as total_points,
           (SELECT reward_title FROM challenges WHERE business_id = b.id AND is_active = true ORDER BY points_value DESC LIMIT 1) as best_reward_title,
           (SELECT points_value FROM challenges WHERE business_id = b.id AND is_active = true ORDER BY points_value DESC LIMIT 1) as best_reward_points,
           (SELECT COUNT(*) FROM completions co JOIN challenges ch ON ch.id = co.challenge_id WHERE ch.business_id = b.id AND co.status IN ('confirmed','claimed') AND co.updated_at > NOW() - INTERVAL '7 days') as weekly_completions,
           (SELECT COUNT(*) FROM completions co JOIN challenges ch ON ch.id = co.challenge_id WHERE ch.business_id = b.id AND co.status IN ('confirmed','claimed')) as total_completions
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
  if (country) {
    params.push(country);
    sql += ` AND ci.country = $${params.length}`;
  }

  sql += ' GROUP BY b.id, ci.name, ci.slug, ci.country ORDER BY challenge_count DESC, b.created_at DESC LIMIT 500';

  const { rows } = await query(sql, params);
  res.json(rows);
};

const updateBusiness = async (req, res) => {
  const { id } = req.params;
  const { name, description, category, address, phone, website, googleMapsUrl, logoUrl, coverUrl } = req.body;

  const { rows: owned } = await query(
    'SELECT b.id, b.address FROM businesses b WHERE b.id = $1 AND b.owner_id = $2',
    [id, req.user.id]
  );
  if (!owned.length) return res.status(403).json({ error: 'Forbidden' });

  let latUpdate = '', latParams = [];
  if (address && address !== owned[0].address) {
    const { rows: bizCity } = await query(
      'SELECT ci.name, ci.country FROM businesses b JOIN cities ci ON ci.id = b.city_id WHERE b.id = $1',
      [id]
    );
    const coords = await geocodeAddress(address, bizCity[0]?.name, bizCity[0]?.country);
    if (coords) {
      latUpdate = ', latitude = $11, longitude = $12';
      latParams = [coords.lat, coords.lng];
    }
  }

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
       ${latUpdate}
     WHERE id = $10 RETURNING *`,
    [name, description, category, address, phone, website, googleMapsUrl, logoUrl, coverUrl, id, ...latParams]
  );
  res.json(rows[0]);
};

const getBusinessStats = async (req, res) => {
  const { id } = req.params;
  const { rows: owned } = await query('SELECT id FROM businesses WHERE id = $1 AND owner_id = $2', [id, req.user.id]);
  if (!owned.length) return res.status(403).json({ error: 'Forbidden' });

  const { rows: daily } = await query(
    `SELECT TO_CHAR(created_at AT TIME ZONE 'UTC', 'Mon DD') as day,
            DATE(created_at AT TIME ZONE 'UTC') as date,
            COUNT(*) as count
     FROM completions
     WHERE business_id = $1 AND status IN ('confirmed','claimed') AND created_at > NOW() - INTERVAL '30 days'
     GROUP BY day, date
     ORDER BY date ASC`,
    [id]
  );

  const { rows: totals } = await query(
    `SELECT COUNT(*) as total_completions,
            COALESCE(SUM(points_earned), 0) as total_points,
            COUNT(DISTINCT user_id) as unique_customers
     FROM completions WHERE business_id = $1 AND status IN ('confirmed','claimed')`,
    [id]
  );

  res.json({ daily, ...totals[0] });
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

const getBusinessAnalytics = async (req, res) => {
  const { id } = req.params;
  const { rows: owned } = await query('SELECT id, category FROM businesses WHERE id = $1 AND owner_id = $2', [id, req.user.id]);
  if (!owned.length) return res.status(403).json({ error: 'Forbidden' });
  const category = owned[0].category;

  const [weekly, dayOfWeek, challengePerf, customers, newVsReturning, atRisk, benchmark] = await Promise.all([

    query(`
      SELECT DATE_TRUNC('week', updated_at AT TIME ZONE 'UTC') as week, COUNT(*) as count
      FROM completions
      WHERE business_id = $1 AND status IN ('confirmed','claimed') AND updated_at > NOW() - INTERVAL '8 weeks'
      GROUP BY week ORDER BY week ASC`, [id]),

    query(`
      SELECT EXTRACT(DOW FROM updated_at AT TIME ZONE 'UTC') as dow,
             TO_CHAR(updated_at AT TIME ZONE 'UTC', 'Dy') as day_name,
             COUNT(*) as count
      FROM completions
      WHERE business_id = $1 AND status IN ('confirmed','claimed')
      GROUP BY dow, day_name ORDER BY dow ASC`, [id]),

    query(`
      SELECT c.id, c.title, c.type, c.reward_title, c.points_value, c.is_active,
             COUNT(co.id) as total_completions,
             COUNT(DISTINCT co.user_id) as unique_customers
      FROM challenges c
      LEFT JOIN completions co ON co.challenge_id = c.id AND co.status IN ('confirmed','claimed')
      WHERE c.business_id = $1
      GROUP BY c.id ORDER BY total_completions DESC`, [id]),

    query(`
      SELECT u.id, u.full_name, u.avatar_url,
             COUNT(co.id) as total_completions,
             MAX(co.updated_at) as last_seen,
             COALESCE(SUM(co.points_earned), 0) as points_earned
      FROM completions co
      JOIN users u ON u.id = co.user_id
      WHERE co.business_id = $1 AND co.status IN ('confirmed','claimed')
      GROUP BY u.id, u.full_name, u.avatar_url
      ORDER BY last_seen DESC`, [id]),

    query(`
      SELECT
        SUM(CASE WHEN first_visit >= DATE_TRUNC('month', NOW()) THEN 1 ELSE 0 END) as new_customers,
        SUM(CASE WHEN first_visit < DATE_TRUNC('month', NOW()) AND last_visit >= DATE_TRUNC('month', NOW()) THEN 1 ELSE 0 END) as returning_customers
      FROM (
        SELECT user_id, MIN(updated_at) as first_visit, MAX(updated_at) as last_visit
        FROM completions WHERE business_id = $1 AND status IN ('confirmed','claimed')
        GROUP BY user_id
      ) sub`, [id]),

    query(`
      SELECT u.id, u.full_name, u.avatar_url,
             COUNT(co.id) as total_completions,
             MAX(co.updated_at) as last_seen,
             EXTRACT(DAY FROM NOW() - MAX(co.updated_at)) as days_away
      FROM completions co
      JOIN users u ON u.id = co.user_id
      WHERE co.business_id = $1 AND co.status IN ('confirmed','claimed')
      GROUP BY u.id, u.full_name, u.avatar_url
      HAVING MAX(co.updated_at) < NOW() - INTERVAL '21 days'
      ORDER BY MAX(co.updated_at) ASC LIMIT 10`, [id]),

    query(`
      WITH my_stats AS (
        SELECT CASE WHEN COUNT(DISTINCT user_id) > 0
          THEN ROUND(COUNT(*)::numeric / COUNT(DISTINCT user_id), 1) ELSE 0 END as my_avg
        FROM completions WHERE business_id = $1 AND status IN ('confirmed','claimed')
      ),
      cat_stats AS (
        SELECT b.id,
          CASE WHEN COUNT(DISTINCT co.user_id) > 0
            THEN COUNT(co.id)::numeric / COUNT(DISTINCT co.user_id) ELSE 0 END as biz_avg
        FROM businesses b
        LEFT JOIN completions co ON co.business_id = b.id AND co.status IN ('confirmed','claimed')
        WHERE b.is_active = true AND b.category = $2
        GROUP BY b.id
      )
      SELECT
        (SELECT my_avg FROM my_stats) as my_avg,
        ROUND(AVG(biz_avg), 1) as category_avg,
        ROUND(PERCENTILE_CONT(0.8) WITHIN GROUP (ORDER BY biz_avg), 1) as top_avg
      FROM cat_stats`, [id, category]),
  ]);

  const thisWeek = weekly.rows[weekly.rows.length - 1]?.count || 0;
  const lastWeek = weekly.rows[weekly.rows.length - 2]?.count || 0;
  const weekChange = lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : null;

  res.json({
    weekly: weekly.rows,
    weekChange,
    dayOfWeek: dayOfWeek.rows,
    challengePerf: challengePerf.rows,
    customers: customers.rows,
    newVsReturning: newVsReturning.rows[0],
    atRisk: atRisk.rows,
    benchmark: benchmark.rows[0],
  });
};

const getBusinessLeaderboard = async (req, res) => {
  const { id } = req.params;
  const { rows } = await query(
    `SELECT u.id, u.full_name, u.avatar_url,
            COALESCE(SUM(co.points_earned), 0) as total_points,
            COUNT(*) as completions
     FROM completions co
     JOIN users u ON u.id = co.user_id
     WHERE co.business_id = $1 AND co.status IN ('confirmed','claimed')
     GROUP BY u.id, u.full_name, u.avatar_url
     ORDER BY total_points DESC, completions DESC
     LIMIT 10`,
    [id]
  );
  res.json(rows);
};

module.exports = { createBusiness, getMyBusiness, getBusinessBySlug, getBusinessesByCity, getAllBusinesses, updateBusiness, getQRCode, getBusinessStats, getBusinessAnalytics, getBusinessLeaderboard };
