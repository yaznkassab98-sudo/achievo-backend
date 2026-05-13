const router = require('express').Router();
const { createChallenge, getChallenges, updateChallenge, deleteChallenge } = require('../controllers/challengeController');
const { authenticate, requireRole } = require('../middleware/auth');
const { checkChallengeLimit } = require('../middleware/planLimits');

router.get('/business/:businessId', getChallenges);
router.post('/', authenticate, requireRole('business_owner'), checkChallengeLimit, createChallenge);
router.put('/:id', authenticate, requireRole('business_owner'), updateChallenge);
router.delete('/:id', authenticate, requireRole('business_owner'), deleteChallenge);

module.exports = router;
