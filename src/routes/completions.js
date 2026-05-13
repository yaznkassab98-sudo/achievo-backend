const router = require('express').Router();
const { submitCompletion, getPendingCompletions, confirmCompletion, rejectCompletion, getUserCompletions } = require('../controllers/completionController');
const { authenticate, requireRole } = require('../middleware/auth');

router.post('/', authenticate, requireRole('customer'), submitCompletion);
router.get('/pending/:businessId', authenticate, requireRole('business_owner'), getPendingCompletions);
router.put('/:id/confirm', confirmCompletion);
router.put('/:id/reject', authenticate, requireRole('business_owner'), rejectCompletion);
router.get('/mine', authenticate, getUserCompletions);

module.exports = router;
