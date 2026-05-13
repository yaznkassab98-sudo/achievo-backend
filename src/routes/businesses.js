const router = require('express').Router();
const { createBusiness, getMyBusiness, getBusinessBySlug, getBusinessesByCity, getAllBusinesses, updateBusiness, getQRCode } = require('../controllers/businessController');
const { authenticate, requireRole } = require('../middleware/auth');

router.get('/', getAllBusinesses);
router.get('/city/:citySlug', getBusinessesByCity);
router.get('/slug/:slug', getBusinessBySlug);
router.get('/mine', authenticate, requireRole('business_owner'), getMyBusiness);
router.get('/:id/qr', authenticate, requireRole('business_owner'), getQRCode);
router.post('/', authenticate, requireRole('business_owner'), createBusiness);
router.put('/:id', authenticate, requireRole('business_owner'), updateBusiness);

module.exports = router;
