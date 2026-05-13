const { v4: uuidv4 } = require('uuid');
const { query } = require('../lib/db');

const createChallenge = async (req, res) => {
  const { businessId, title, description, type, rewardTitle, rewardDescription, rewardType,
          discountPercent, pointsValue, maxCompletions, expiresAt } = req.body;

  if (!businessId || !title || !rewardTitle) {
    return res.status(400).json({ error: 'businessId, title, and rewardTitle are required' });
  }

  const { rows: owned } = await query('SELECT id FROM businesses WHERE id = $1 AND owner_id = $2', [businessId, req.user.id]);
  if (!owned.length) return res.status(403).json({ error: 'Forbidden' });

  const { rows } = await query(
    `INSERT INTO challenges (id, business_id, title, description, type, reward_title, reward_description,
      reward_type, discount_percent, points_value, max_completions, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [uuidv4(), businessId, title, description || null, type || 'custom', rewardTitle,
     rewardDescription || null, rewardType || 'free_item', discountPercent || null,
     pointsValue || 0, maxCompletions || null, expiresAt || null]
  );
  res.status(201).json(rows[0]);
};

const getChallenges = async (req, res) => {
  const { businessId } = req.params;
  const { rows } = await query(
    `SELECT c.*,
       COUNT(co.id) FILTER (WHERE co.status = 'confirmed') as confirmed_count
     FROM challenges c
     LEFT JOIN completions co ON co.challenge_id = c.id
     WHERE c.business_id = $1
     GROUP BY c.id
     ORDER BY c.created_at DESC`,
    [businessId]
  );
  res.json(rows);
};

const updateChallenge = async (req, res) => {
  const { id } = req.params;
  const { title, description, rewardTitle, rewardDescription, rewardType, discountPercent,
          pointsValue, maxCompletions, expiresAt, isActive } = req.body;

  const { rows: owned } = await query(
    `SELECT c.id FROM challenges c JOIN businesses b ON b.id = c.business_id
     WHERE c.id = $1 AND b.owner_id = $2`,
    [id, req.user.id]
  );
  if (!owned.length) return res.status(403).json({ error: 'Forbidden' });

  const { rows } = await query(
    `UPDATE challenges SET
       title = COALESCE($1, title),
       description = COALESCE($2, description),
       reward_title = COALESCE($3, reward_title),
       reward_description = COALESCE($4, reward_description),
       reward_type = COALESCE($5, reward_type),
       discount_percent = COALESCE($6, discount_percent),
       points_value = COALESCE($7, points_value),
       max_completions = COALESCE($8, max_completions),
       expires_at = COALESCE($9, expires_at),
       is_active = COALESCE($10, is_active)
     WHERE id = $11 RETURNING *`,
    [title, description, rewardTitle, rewardDescription, rewardType, discountPercent,
     pointsValue, maxCompletions, expiresAt, isActive, id]
  );
  res.json(rows[0]);
};

const deleteChallenge = async (req, res) => {
  const { id } = req.params;
  const { rows: owned } = await query(
    `SELECT c.id FROM challenges c JOIN businesses b ON b.id = c.business_id
     WHERE c.id = $1 AND b.owner_id = $2`,
    [id, req.user.id]
  );
  if (!owned.length) return res.status(403).json({ error: 'Forbidden' });

  await query('UPDATE challenges SET is_active = false WHERE id = $1', [id]);
  res.json({ success: true });
};

module.exports = { createChallenge, getChallenges, updateChallenge, deleteChallenge };
