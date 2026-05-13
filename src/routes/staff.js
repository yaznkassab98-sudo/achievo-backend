const router = require('express').Router();
const { getStaff, addStaff, updateStaff, removeStaff } = require('../controllers/staffController');
const { authenticate, requireRole } = require('../middleware/auth');
const { checkStaffLimit } = require('../middleware/planLimits');

router.get('/:businessId', authenticate, requireRole('business_owner'), getStaff);
router.post('/', authenticate, requireRole('business_owner'), checkStaffLimit, addStaff);
router.put('/:id', authenticate, requireRole('business_owner'), updateStaff);
router.delete('/:id', authenticate, requireRole('business_owner'), removeStaff);

module.exports = router;
