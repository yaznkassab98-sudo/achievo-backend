const { v4: uuidv4 } = require('uuid');
const { query } = require('../lib/db');

const getTemplates = async (req, res) => {
  const { category, activeOnly } = req.query;
  const params = [];
  let sql = `SELECT * FROM challenge_templates`;
  const conditions = [];

  if (activeOnly === 'true' || req.user?.role !== 'admin') {
    conditions.push(`is_active = true`);
  }
  if (category) {
    params.push(category);
    conditions.push(`(category = $${params.length} OR category IS NULL)`);
  }

  if (conditions.length) sql += ` WHERE ${conditions.join(' AND ')}`;
  sql += ` ORDER BY sort_order ASC, created_at ASC`;

  const { rows } = await query(sql, params);
  res.json(rows);
};

const createTemplate = async (req, res) => {
  const {
    title, description, rewardTitle, rewardDescription,
    rewardType, discountPercent, pointsValue, icon, category, tags, sortOrder,
  } = req.body;

  if (!title || !rewardTitle) {
    return res.status(400).json({ error: 'title and rewardTitle are required' });
  }

  const { rows } = await query(
    `INSERT INTO challenge_templates
       (id, title, description, reward_title, reward_description, reward_type,
        discount_percent, points_value, icon, category, tags, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [
      uuidv4(), title, description || null, rewardTitle, rewardDescription || null,
      rewardType || 'free_item', discountPercent || null, pointsValue || 0,
      icon || '🎯', category || null,
      tags ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim())) : [],
      sortOrder || 0,
    ]
  );
  res.status(201).json(rows[0]);
};

const updateTemplate = async (req, res) => {
  const { id } = req.params;
  const {
    title, description, rewardTitle, rewardDescription,
    rewardType, discountPercent, pointsValue, icon, category, tags, sortOrder, isActive,
  } = req.body;

  const { rows } = await query(
    `UPDATE challenge_templates SET
       title              = COALESCE($1, title),
       description        = COALESCE($2, description),
       reward_title       = COALESCE($3, reward_title),
       reward_description = COALESCE($4, reward_description),
       reward_type        = COALESCE($5, reward_type),
       discount_percent   = COALESCE($6, discount_percent),
       points_value       = COALESCE($7, points_value),
       icon               = COALESCE($8, icon),
       category           = COALESCE($9, category),
       tags               = COALESCE($10, tags),
       sort_order         = COALESCE($11, sort_order),
       is_active          = COALESCE($12, is_active),
       updated_at         = NOW()
     WHERE id = $13 RETURNING *`,
    [
      title || null, description || null, rewardTitle || null, rewardDescription || null,
      rewardType || null, discountPercent !== undefined ? discountPercent : null,
      pointsValue !== undefined ? pointsValue : null,
      icon || null, category || null,
      tags ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim())) : null,
      sortOrder !== undefined ? sortOrder : null,
      isActive !== undefined ? isActive : null,
      id,
    ]
  );
  if (!rows.length) return res.status(404).json({ error: 'Template not found' });
  res.json(rows[0]);
};

const deleteTemplate = async (req, res) => {
  const { id } = req.params;
  const { rows } = await query(
    `DELETE FROM challenge_templates WHERE id = $1 RETURNING id`,
    [id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Template not found' });
  res.json({ success: true });
};

const toggleTemplate = async (req, res) => {
  const { id } = req.params;
  const { rows } = await query(
    `UPDATE challenge_templates SET is_active = NOT is_active, updated_at = NOW()
     WHERE id = $1 RETURNING id, title, is_active`,
    [id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Template not found' });
  res.json(rows[0]);
};

module.exports = { getTemplates, createTemplate, updateTemplate, deleteTemplate, toggleTemplate };
