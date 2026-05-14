const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { getTemplates } = require('../controllers/templateController');

router.get('/', authenticate, requireRole('business_owner'), getTemplates);

module.exports = router;
