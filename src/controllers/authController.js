const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { v4: uuidv4 } = require('uuid')
const { query } = require('../lib/db')
const { sendVerificationEmail } = require('../lib/email')

const signToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '15m' })

const signRefreshToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' })

const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString()

const generateReferralCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

const signup = async (req, res) => {
  const { email, password, fullName, role, cityId, phone, avatarUrl, referralCode } = req.body

  if (!email || !password || !fullName || !role)
    return res.status(400).json({ error: 'email, password, fullName, and role are required' })

  if (!['customer', 'business_owner'].includes(role))
    return res.status(400).json({ error: 'role must be customer or business_owner' })

  if (password.length < 8)
    return res.status(400).json({ error: 'Password must be at least 8 characters' })

  const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()])
  if (existing.rows.length)
    return res.status(409).json({ error: 'Email already registered' })

  let referredById = null
  if (referralCode) {
    const { rows: refRows } = await query('SELECT id FROM users WHERE referral_code = $1', [referralCode.toUpperCase()])
    if (refRows.length) referredById = refRows[0].id
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const userId = uuidv4()
  let myReferralCode = generateReferralCode()
  const codeConflict = await query('SELECT id FROM users WHERE referral_code = $1', [myReferralCode])
  if (codeConflict.rows.length) myReferralCode = generateReferralCode()

  await query(
    `INSERT INTO users (id, email, password_hash, full_name, role, city_id, phone, avatar_url, is_verified, referral_code, referred_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, $9, $10)`,
    [userId, email.toLowerCase(), passwordHash, fullName, role, cityId || null, phone || null, avatarUrl || null, myReferralCode, referredById]
  )

  const code = generateOtp()
  await query(
    `INSERT INTO email_verifications (id, user_id, code, expires_at)
     VALUES ($1, $2, $3, NOW() + INTERVAL '15 minutes')`,
    [uuidv4(), userId, code]
  )

  try {
    await sendVerificationEmail(email, fullName, code)
  } catch (emailErr) {
    console.error('Email send failed:', emailErr.message)
  }

  res.status(201).json({ userId, email: email.toLowerCase(), requiresVerification: true })
}

const verifyOtp = async (req, res) => {
  const { userId, code } = req.body

  if (!userId || !code)
    return res.status(400).json({ error: 'userId and code are required' })

  const { rows } = await query(
    `SELECT id FROM email_verifications
     WHERE user_id = $1 AND code = $2 AND used = false AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [userId, code.trim()]
  )

  if (!rows.length)
    return res.status(400).json({ error: 'Invalid or expired verification code' })

  await query('UPDATE email_verifications SET used = true WHERE id = $1', [rows[0].id])
  await query('UPDATE users SET is_verified = true WHERE id = $1', [userId])

  const { rows: userRows } = await query(
    'SELECT id, email, full_name, role, city_id, total_points, avatar_url FROM users WHERE id = $1',
    [userId]
  )

  const user = userRows[0]
  const token = signToken(user.id)
  const refreshToken = signRefreshToken(user.id)

  res.json({ token, refreshToken, user })
}

const resendOtp = async (req, res) => {
  const { userId } = req.body

  if (!userId) return res.status(400).json({ error: 'userId is required' })

  const { rows: userRows } = await query(
    'SELECT id, email, full_name, is_verified FROM users WHERE id = $1',
    [userId]
  )
  if (!userRows.length) return res.status(404).json({ error: 'User not found' })
  if (userRows[0].is_verified) return res.status(400).json({ error: 'Already verified' })

  const { rows: recent } = await query(
    `SELECT id FROM email_verifications
     WHERE user_id = $1 AND created_at > NOW() - INTERVAL '60 seconds'`,
    [userId]
  )
  if (recent.length)
    return res.status(429).json({ error: 'Please wait before requesting a new code' })

  const code = generateOtp()
  await query(
    `INSERT INTO email_verifications (id, user_id, code, expires_at)
     VALUES ($1, $2, $3, NOW() + INTERVAL '15 minutes')`,
    [uuidv4(), userId, code]
  )

  try {
    await sendVerificationEmail(userRows[0].email, userRows[0].full_name, code)
  } catch (emailErr) {
    console.error('Email send failed:', emailErr.message)
  }

  res.json({ message: 'Code sent' })
}

const login = async (req, res) => {
  const { email, password } = req.body

  if (!email || !password)
    return res.status(400).json({ error: 'email and password are required' })

  const { rows } = await query(
    'SELECT id, email, password_hash, full_name, role, city_id, total_points, avatar_url, is_verified FROM users WHERE email = $1',
    [email.toLowerCase()]
  )

  if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' })

  const user = rows[0]
  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' })

  if (!user.is_verified) {
    const code = generateOtp()
    await query(
      `INSERT INTO email_verifications (id, user_id, code, expires_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '15 minutes')`,
      [uuidv4(), user.id, code]
    )
    try { await sendVerificationEmail(user.email, user.full_name, code) } catch {}
    return res.status(403).json({
      error: 'Email not verified',
      requiresVerification: true,
      userId: user.id,
      email: user.email,
    })
  }

  const { password_hash, ...safeUser } = user
  const token = signToken(user.id)
  const refreshToken = signRefreshToken(user.id)

  res.json({ token, refreshToken, user: safeUser })
}

const refresh = async (req, res) => {
  const { refreshToken } = req.body
  if (!refreshToken) return res.status(400).json({ error: 'refreshToken required' })

  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET)
    const { rows } = await query('SELECT id FROM users WHERE id = $1', [payload.userId])
    if (!rows.length) return res.status(401).json({ error: 'User not found' })
    res.json({ token: signToken(payload.userId) })
  } catch {
    return res.status(401).json({ error: 'Invalid or expired refresh token' })
  }
}

const me = async (req, res) => {
  const { rows } = await query(
    'SELECT id, email, full_name, role, city_id, total_points, avatar_url, phone, is_verified, created_at FROM users WHERE id = $1',
    [req.user.id]
  )
  res.json(rows[0])
}

const updateProfile = async (req, res) => {
  const { fullName, phone, cityId, avatarUrl } = req.body
  if (!fullName) return res.status(400).json({ error: 'fullName is required' })

  const { rows } = await query(
    `UPDATE users SET
       full_name = $1,
       phone = COALESCE($2, phone),
       city_id = COALESCE($3, city_id),
       avatar_url = COALESCE($4, avatar_url)
     WHERE id = $5
     RETURNING id, email, full_name, role, city_id, total_points, phone, avatar_url`,
    [fullName, phone || null, cityId || null, avatarUrl || null, req.user.id]
  )
  res.json(rows[0])
}

const forgotPassword = async (req, res) => {
  const { email } = req.body
  if (!email) return res.status(400).json({ error: 'email is required' })

  const { rows } = await query(
    'SELECT id, email, full_name FROM users WHERE email = $1 AND is_verified = true',
    [email.toLowerCase()]
  )

  if (!rows.length) return res.json({ message: 'If that email exists, a reset code has been sent' })

  const user = rows[0]
  const { rows: recent } = await query(
    `SELECT id FROM email_verifications WHERE user_id = $1 AND created_at > NOW() - INTERVAL '60 seconds'`,
    [user.id]
  )
  if (recent.length) return res.status(429).json({ error: 'Please wait before requesting a new code' })

  const code = generateOtp()
  await query(
    `INSERT INTO email_verifications (id, user_id, code, expires_at)
     VALUES ($1, $2, $3, NOW() + INTERVAL '15 minutes')`,
    [uuidv4(), user.id, code]
  )

  try {
    await sendVerificationEmail(user.email, user.full_name, code)
  } catch (err) {
    console.error('Email send failed:', err.message)
  }

  res.json({ userId: user.id })
}

const resetPassword = async (req, res) => {
  const { userId, code, newPassword } = req.body
  if (!userId || !code || !newPassword)
    return res.status(400).json({ error: 'userId, code, and newPassword are required' })

  if (newPassword.length < 8)
    return res.status(400).json({ error: 'Password must be at least 8 characters' })

  const { rows } = await query(
    `SELECT id FROM email_verifications
     WHERE user_id = $1 AND code = $2 AND used = false AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [userId, code.trim()]
  )

  if (!rows.length) return res.status(400).json({ error: 'Invalid or expired reset code' })

  await query('UPDATE email_verifications SET used = true WHERE id = $1', [rows[0].id])
  const passwordHash = await bcrypt.hash(newPassword, 12)
  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId])

  res.json({ message: 'Password reset successfully' })
}

module.exports = { signup, verifyOtp, resendOtp, login, refresh, me, updateProfile, forgotPassword, resetPassword }
