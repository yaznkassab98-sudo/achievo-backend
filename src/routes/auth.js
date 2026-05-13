const router = require('express').Router()
const { signup, verifyOtp, resendOtp, login, refresh, me, updateProfile } = require('../controllers/authController')
const { authenticate } = require('../middleware/auth')

router.post('/signup', signup)
router.post('/verify-otp', verifyOtp)
router.post('/resend-otp', resendOtp)
router.post('/login', login)
router.post('/refresh', refresh)
router.get('/me', authenticate, me)
router.put('/profile', authenticate, updateProfile)

module.exports = router
