const { v4: uuidv4 } = require('uuid');
const { query, getClient } = require('../lib/db');
const { sendRewardConfirmedEmail } = require('../lib/email');

const submitCompletion = async (req, res) => {
  const { challengeId } = req.body;
  if (!challengeId) return res.status(400).json({ error: 'challengeId required' });

  const { rows: challenge } = await query(
    `SELECT c.*, b.id as business_id FROM challenges c
     JOIN businesses b ON b.id = c.business_id
     WHERE c.id = $1 AND c.is_active = true`,
    [challengeId]
  );
  if (!challenge.length) return res.status(404).json({ error: 'Challenge not found or inactive' });

  const ch = challenge[0];

  if (ch.expires_at && new Date(ch.expires_at) < new Date()) {
    return res.status(400).json({ error: 'Challenge has expired' });
  }

  const existing = await query(
    `SELECT id FROM completions WHERE user_id = $1 AND challenge_id = $2 AND status IN ('pending','confirmed','claimed')`,
    [req.user.id, challengeId]
  );
  if (existing.rows.length) {
    return res.status(409).json({ error: 'You have already submitted or completed this challenge' });
  }

  if (ch.max_completions) {
    const { rows: count } = await query(
      `SELECT COUNT(*) as c FROM completions WHERE challenge_id = $1 AND status IN ('confirmed','claimed')`,
      [challengeId]
    );
    if (parseInt(count[0].c) >= ch.max_completions) {
      return res.status(400).json({ error: 'Challenge has reached its maximum completions' });
    }
  }

  const { rows } = await query(
    `INSERT INTO completions (id, user_id, challenge_id, business_id, status, points_earned)
     VALUES ($1, $2, $3, $4, 'pending', $5) RETURNING *`,
    [uuidv4(), req.user.id, challengeId, ch.business_id, ch.points_value]
  );

  res.status(201).json(rows[0]);
};

const getPendingCompletions = async (req, res) => {
  const { businessId } = req.params;

  const { rows: owned } = await query(
    'SELECT id FROM businesses WHERE id = $1 AND owner_id = $2',
    [businessId, req.user.id]
  );
  if (!owned.length) return res.status(403).json({ error: 'Forbidden' });

  const { rows } = await query(
    `SELECT co.*, u.full_name, u.email, u.avatar_url, ch.title as challenge_title, ch.reward_title
     FROM completions co
     JOIN users u ON u.id = co.user_id
     JOIN challenges ch ON ch.id = co.challenge_id
     WHERE co.business_id = $1 AND co.status = 'pending'
     ORDER BY co.created_at ASC`,
    [businessId]
  );
  res.json(rows);
};

const getStaffPendingCompletions = async (req, res) => {
  const { businessId } = req.params;
  const { rows } = await query(
    `SELECT co.*, u.full_name, u.email, u.avatar_url, ch.title as challenge_title, ch.reward_title
     FROM completions co
     JOIN users u ON u.id = co.user_id
     JOIN challenges ch ON ch.id = co.challenge_id
     WHERE co.business_id = $1 AND co.status = 'pending'
     ORDER BY co.created_at ASC`,
    [businessId]
  );
  res.json(rows);
};

const confirmCompletion = async (req, res) => {
  const { id } = req.params;
  const { pin } = req.body;

  if (!pin) return res.status(400).json({ error: 'PIN required' });

  const { rows: comp } = await query(
    `SELECT co.*, ch.reward_title, ch.points_value, b.name as business_name,
            u.email as user_email, u.full_name as user_name
     FROM completions co
     JOIN challenges ch ON ch.id = co.challenge_id
     JOIN businesses b ON b.id = co.business_id
     JOIN users u ON u.id = co.user_id
     WHERE co.id = $1`,
    [id]
  );
  if (!comp.length) return res.status(404).json({ error: 'Completion not found' });
  if (comp[0].status !== 'pending') return res.status(400).json({ error: 'Completion is not pending' });

  const { rows: staff } = await query(
    'SELECT id FROM staff WHERE business_id = $1 AND pin_code = $2 AND is_active = true',
    [comp[0].business_id, pin]
  );
  if (!staff.length) return res.status(401).json({ error: 'Invalid PIN' });

  const client = await getClient();
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE completions SET status = 'confirmed', confirmed_by = $1 WHERE id = $2`,
      [staff[0].id, id]
    );

    await client.query(
      `INSERT INTO saved_rewards (id, user_id, completion_id, challenge_id, business_id, reward_title)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [uuidv4(), comp[0].user_id, id, comp[0].challenge_id, comp[0].business_id, comp[0].reward_title]
    );

    if (comp[0].points_value > 0) {
      await client.query(
        'UPDATE users SET total_points = total_points + $1 WHERE id = $2',
        [comp[0].points_value, comp[0].user_id]
      );
    }

    await client.query('COMMIT');

    try {
      await sendRewardConfirmedEmail(
        comp[0].user_email,
        comp[0].user_name,
        comp[0].business_name,
        comp[0].reward_title,
        comp[0].points_value || 0
      )
    } catch (emailErr) {
      console.error('Reward email failed:', emailErr.message)
    }

    res.json({ success: true, pointsAwarded: comp[0].points_value });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const rejectCompletion = async (req, res) => {
  const { id } = req.params;
  const { notes, pin } = req.body;

  const { rows: comp } = await query('SELECT * FROM completions WHERE id = $1', [id]);
  if (!comp.length) return res.status(404).json({ error: 'Completion not found' });
  if (comp[0].status !== 'pending') return res.status(400).json({ error: 'Completion is not pending' });

  if (pin) {
    const { rows: staff } = await query(
      'SELECT id FROM staff WHERE business_id = $1 AND pin_code = $2 AND is_active = true',
      [comp[0].business_id, pin]
    );
    if (!staff.length) return res.status(401).json({ error: 'Invalid PIN' });
  } else if (req.user) {
    const { rows: owned } = await query(
      'SELECT id FROM businesses WHERE id = $1 AND owner_id = $2',
      [comp[0].business_id, req.user.id]
    );
    if (!owned.length) return res.status(403).json({ error: 'Forbidden' });
  } else {
    return res.status(401).json({ error: 'PIN or owner auth required' });
  }

  await query(
    `UPDATE completions SET status = 'rejected', notes = $1 WHERE id = $2`,
    [notes || null, id]
  );
  res.json({ success: true });
};

const getUserCompletions = async (req, res) => {
  const { rows } = await query(
    `SELECT co.*, ch.title as challenge_title, ch.reward_title, b.name as business_name, b.logo_url
     FROM completions co
     JOIN challenges ch ON ch.id = co.challenge_id
     JOIN businesses b ON b.id = co.business_id
     WHERE co.user_id = $1
     ORDER BY co.created_at DESC`,
    [req.user.id]
  );
  res.json(rows);
};

const getUserProgress = async (req, res) => {
  const { businessId } = req.params;
  const { rows } = await query(
    `SELECT challenge_id, status FROM completions WHERE user_id = $1 AND business_id = $2`,
    [req.user.id, businessId]
  );
  res.json(rows);
};

module.exports = { submitCompletion, getPendingCompletions, getStaffPendingCompletions, confirmCompletion, rejectCompletion, getUserCompletions, getUserProgress };
