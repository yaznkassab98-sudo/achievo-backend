const { v4: uuidv4 } = require('uuid');
const { query } = require('./db');

const ACHIEVEMENTS = {
  first_completion:  { label: 'First Step',        desc: 'Completed your first challenge',               emoji: '🎯', color: '#2767FF' },
  regular:           { label: 'Regular',            desc: 'Completed 3 challenges at the same business',  emoji: '☕', color: '#FF8A3D' },
  loyal_customer:    { label: 'Loyal Customer',     desc: 'Completed 5 challenges at the same business',  emoji: '💛', color: '#F59E0B' },
  explorer:          { label: 'Explorer',           desc: 'Earned rewards at 3 different businesses',     emoji: '🗺️', color: '#A78BFA' },
  globe_trotter:     { label: 'Globe Trotter',      desc: 'Earned rewards in 2 or more cities',           emoji: '✈️', color: '#38BDF8' },
  centurion:         { label: 'Centurion',          desc: 'Earned 100 or more points',                    emoji: '⭐', color: '#22C55E' },
  high_flyer:        { label: 'High Flyer',         desc: 'Earned 500 or more points',                    emoji: '🚀', color: '#F472B6' },
  legend:            { label: 'Legend',             desc: 'Earned 1,000 or more points',                  emoji: '👑', color: '#F59E0B' },
  challenge_master:  { label: 'Challenge Master',   desc: 'Completed 10 challenges in total',             emoji: '🏆', color: '#FF5C3A' },
};

const checkAndAward = async (userId, businessId) => {
  try {
    const [statsRes, bizRes, userRes] = await Promise.all([
      query(
        `SELECT COUNT(*) as total,
                COUNT(DISTINCT co.business_id) as businesses,
                COUNT(DISTINCT ci.id) as cities
         FROM completions co
         JOIN businesses b ON b.id = co.business_id
         JOIN cities ci ON ci.id = b.city_id
         WHERE co.user_id = $1 AND co.status IN ('confirmed','claimed')`,
        [userId]
      ),
      query(
        `SELECT COUNT(*) as count FROM completions
         WHERE user_id = $1 AND business_id = $2 AND status IN ('confirmed','claimed')`,
        [userId, businessId]
      ),
      query('SELECT total_points FROM users WHERE id = $1', [userId]),
    ]);

    const total     = parseInt(statsRes.rows[0].total) || 0;
    const businesses = parseInt(statsRes.rows[0].businesses) || 0;
    const cities    = parseInt(statsRes.rows[0].cities) || 0;
    const bizCount  = parseInt(bizRes.rows[0].count) || 0;
    const points    = parseInt(userRes.rows[0]?.total_points) || 0;

    const toAward = [];
    if (total >= 1)     toAward.push('first_completion');
    if (bizCount >= 3)  toAward.push('regular');
    if (bizCount >= 5)  toAward.push('loyal_customer');
    if (businesses >= 3) toAward.push('explorer');
    if (cities >= 2)    toAward.push('globe_trotter');
    if (points >= 100)  toAward.push('centurion');
    if (points >= 500)  toAward.push('high_flyer');
    if (points >= 1000) toAward.push('legend');
    if (total >= 10)    toAward.push('challenge_master');

    for (const type of toAward) {
      await query(
        `INSERT INTO user_achievements (id, user_id, type) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [uuidv4(), userId, type]
      );
    }
  } catch (err) {
    console.error('[Achievements] Error:', err.message);
  }
};

module.exports = { ACHIEVEMENTS, checkAndAward };
