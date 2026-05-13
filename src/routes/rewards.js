const router = require('express').Router();
const { getUserRewards, useReward } = require('../controllers/rewardController');
const { authenticate } = require('../middleware/auth');

router.get('/mine', authenticate, getUserRewards);
router.put('/:id/use', authenticate, useReward);

module.exports = router;
