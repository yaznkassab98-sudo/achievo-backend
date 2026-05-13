const { query } = require('../lib/db');

const getCities = async (req, res) => {
  const { rows } = await query('SELECT id, name, country, slug FROM cities WHERE is_active = true ORDER BY name');
  res.json(rows);
};

module.exports = { getCities };
