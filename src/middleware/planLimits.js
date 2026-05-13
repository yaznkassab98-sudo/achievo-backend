const { query } = require('../lib/db');

const checkChallengeLimit = async (req, res, next) => {
  const { businessId } = req.body;
  if (!businessId) return next();

  const { rows } = await query(`
    SELECT s.max_challenges, COUNT(c.id) as current_count
    FROM subscriptions s
    JOIN businesses b ON b.subscription_id = s.id
    LEFT JOIN challenges c ON c.business_id = b.id AND c.is_active = true
    WHERE b.id = $1
    GROUP BY s.max_challenges
  `, [businessId]);

  if (!rows.length) return res.status(404).json({ error: 'Business not found' });

  const { max_challenges, current_count } = rows[0];
  if (max_challenges !== 999 && parseInt(current_count) >= max_challenges) {
    return res.status(403).json({ error: `Plan limit reached. Upgrade to add more challenges.` });
  }
  next();
};

const checkStaffLimit = async (req, res, next) => {
  const businessId = req.body.businessId || req.params.businessId;
  if (!businessId) return next();

  const { rows } = await query(`
    SELECT s.max_staff, COUNT(st.id) as current_count
    FROM subscriptions s
    JOIN businesses b ON b.subscription_id = s.id
    LEFT JOIN staff st ON st.business_id = b.id AND st.is_active = true
    WHERE b.id = $1
    GROUP BY s.max_staff
  `, [businessId]);

  if (!rows.length) return res.status(404).json({ error: 'Business not found' });

  const { max_staff, current_count } = rows[0];
  if (max_staff !== 999 && parseInt(current_count) >= max_staff) {
    return res.status(403).json({ error: `Plan limit reached. Upgrade to add more staff.` });
  }
  next();
};

module.exports = { checkChallengeLimit, checkStaffLimit };
