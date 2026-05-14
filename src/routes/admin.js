const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const {
  getStats, getRecentActivity, getBusinesses, toggleBusiness,
  getUsers, verifyUser, getCities, createCity, updateCity, toggleCity, getDailyChart,
} = require('../controllers/adminController');

const guard = [authenticate, requireRole('admin')];

router.get('/stats',              ...guard, getStats);
router.get('/activity',           ...guard, getRecentActivity);
router.get('/chart',              ...guard, getDailyChart);
router.get('/businesses',         ...guard, getBusinesses);
router.put('/businesses/:id/toggle', ...guard, toggleBusiness);
router.get('/users',              ...guard, getUsers);
router.put('/users/:id/verify',   ...guard, verifyUser);
router.get('/cities',             ...guard, getCities);
router.post('/cities',            ...guard, createCity);
router.put('/cities/:id',         ...guard, updateCity);
router.put('/cities/:id/toggle',  ...guard, toggleCity);

module.exports = router;
