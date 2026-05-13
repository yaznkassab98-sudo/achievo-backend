const { v4: uuidv4 } = require('uuid');
const { query } = require('../lib/db');

const getStaff = async (req, res) => {
  const { businessId } = req.params;
  const { rows: owned } = await query(
    'SELECT id FROM businesses WHERE id = $1 AND owner_id = $2',
    [businessId, req.user.id]
  );
  if (!owned.length) return res.status(403).json({ error: 'Forbidden' });

  const { rows } = await query(
    'SELECT id, name, role, pin_code, is_active, created_at FROM staff WHERE business_id = $1 ORDER BY created_at',
    [businessId]
  );
  res.json(rows);
};

const addStaff = async (req, res) => {
  const { businessId, name, role, pinCode } = req.body;

  if (!businessId || !name || !pinCode) return res.status(400).json({ error: 'businessId, name, and pinCode are required' });
  if (!/^\d{4,6}$/.test(pinCode)) return res.status(400).json({ error: 'PIN must be 4-6 digits' });

  const { rows: owned } = await query(
    'SELECT id FROM businesses WHERE id = $1 AND owner_id = $2',
    [businessId, req.user.id]
  );
  if (!owned.length) return res.status(403).json({ error: 'Forbidden' });

  const pinConflict = await query(
    'SELECT id FROM staff WHERE business_id = $1 AND pin_code = $2 AND is_active = true',
    [businessId, pinCode]
  );
  if (pinConflict.rows.length) return res.status(409).json({ error: 'PIN already in use' });

  const { rows } = await query(
    `INSERT INTO staff (id, business_id, name, role, pin_code) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [uuidv4(), businessId, name, role || 'cashier', pinCode]
  );
  res.status(201).json(rows[0]);
};

const updateStaff = async (req, res) => {
  const { id } = req.params;
  const { name, role, pinCode, isActive } = req.body;

  const { rows: st } = await query(
    `SELECT s.* FROM staff s JOIN businesses b ON b.id = s.business_id WHERE s.id = $1 AND b.owner_id = $2`,
    [id, req.user.id]
  );
  if (!st.length) return res.status(403).json({ error: 'Forbidden' });

  if (pinCode) {
    const pinConflict = await query(
      'SELECT id FROM staff WHERE business_id = $1 AND pin_code = $2 AND is_active = true AND id != $3',
      [st[0].business_id, pinCode, id]
    );
    if (pinConflict.rows.length) return res.status(409).json({ error: 'PIN already in use' });
  }

  const { rows } = await query(
    `UPDATE staff SET
       name = COALESCE($1, name),
       role = COALESCE($2, role),
       pin_code = COALESCE($3, pin_code),
       is_active = COALESCE($4, is_active)
     WHERE id = $5 RETURNING *`,
    [name, role, pinCode, isActive, id]
  );
  res.json(rows[0]);
};

const removeStaff = async (req, res) => {
  const { id } = req.params;
  const { rows: st } = await query(
    `SELECT s.id FROM staff s JOIN businesses b ON b.id = s.business_id WHERE s.id = $1 AND b.owner_id = $2`,
    [id, req.user.id]
  );
  if (!st.length) return res.status(403).json({ error: 'Forbidden' });

  await query('UPDATE staff SET is_active = false WHERE id = $1', [id]);
  res.json({ success: true });
};

module.exports = { getStaff, addStaff, updateStaff, removeStaff };
