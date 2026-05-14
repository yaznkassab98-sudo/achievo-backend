const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { getMyReferral } = require('../controllers/referralController');

router.get('/mine', authenticate, getMyReferral);

module.exports = router;
