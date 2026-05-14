const { query } = require('../lib/db');

const REFERRAL_BONUS_POINTS = 200;

const getMyReferral = async (req, res) => {
  const { rows } = await query(
    `SELECT
       u.referral_code,
       COUNT(r.id) as referred_count,
       SUM(CASE WHEN r.referral_bonus_paid = true THEN 1 ELSE 0 END) as converted_count
     FROM users u
     LEFT JOIN users r ON r.referred_by = u.id
     WHERE u.id = $1
     GROUP BY u.referral_code`,
    [req.user.id]
  );
  res.json(rows[0] || { referral_code: null, referred_count: 0, converted_count: 0 });
};

const checkAndPayReferralBonus = async (userId) => {
  try {
    const { rows: userRows } = await query(
      'SELECT referred_by, referral_bonus_paid FROM users WHERE id = $1',
      [userId]
    );
    if (!userRows.length) return;
    const { referred_by, referral_bonus_paid } = userRows[0];
    if (!referred_by || referral_bonus_paid) return;

    const { rows: completions } = await query(
      `SELECT COUNT(*) as cnt FROM completions co
       JOIN challenges ch ON ch.id = co.challenge_id
       WHERE co.user_id = $1 AND co.status IN ('confirmed','claimed')`,
      [userId]
    );
    if (parseInt(completions[0].cnt) !== 1) return;

    await query(
      'UPDATE users SET total_points = total_points + $1 WHERE id = $2',
      [REFERRAL_BONUS_POINTS, referred_by]
    );
    await query(
      'UPDATE users SET referral_bonus_paid = true WHERE id = $1',
      [userId]
    );
  } catch {}
};

module.exports = { getMyReferral, checkAndPayReferralBonus };
