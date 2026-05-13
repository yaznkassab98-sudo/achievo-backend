const { query } = require('../lib/db');

const getUserRewards = async (req, res) => {
  const { rows } = await query(
    `SELECT sr.*, b.name as business_name, b.logo_url, b.slug as business_slug
     FROM saved_rewards sr
     JOIN businesses b ON b.id = sr.business_id
     WHERE sr.user_id = $1
     ORDER BY sr.created_at DESC`,
    [req.user.id]
  );
  res.json(rows);
};

const useReward = async (req, res) => {
  const { id } = req.params;

  const { rows } = await query('SELECT * FROM saved_rewards WHERE id = $1 AND user_id = $2', [id, req.user.id]);
  if (!rows.length) return res.status(404).json({ error: 'Reward not found' });
  if (rows[0].status !== 'available') return res.status(400).json({ error: 'Reward is not available' });

  if (rows[0].expires_at && new Date(rows[0].expires_at) < new Date()) {
    await query(`UPDATE saved_rewards SET status = 'expired' WHERE id = $1`, [id]);
    return res.status(400).json({ error: 'Reward has expired' });
  }

  await query(
    `UPDATE saved_rewards SET status = 'used', used_at = NOW() WHERE id = $1`,
    [id]
  );
  await query(
    `UPDATE completions SET status = 'claimed', reward_claimed_at = NOW() WHERE id = $1`,
    [rows[0].completion_id]
  );

  res.json({ success: true });
};

module.exports = { getUserRewards, useReward };
