const router = require('express').Router();
const { submitCompletion, getPendingCompletions, getStaffPendingCompletions, confirmCompletion, rejectCompletion, getUserCompletions, getUserProgress } = require('../controllers/completionController');
const { authenticate, requireRole } = require('../middleware/auth');

router.post('/', authenticate, requireRole('customer'), submitCompletion);
router.get('/pending/:businessId', authenticate, requireRole('business_owner'), getPendingCompletions);
router.get('/staff-pending/:businessId', getStaffPendingCompletions);
router.put('/:id/confirm', confirmCompletion);
router.put('/:id/reject', authenticate, requireRole('business_owner'), rejectCompletion);
router.get('/mine', authenticate, getUserCompletions);
router.get('/progress/:businessId', authenticate, getUserProgress);

module.exports = router;
