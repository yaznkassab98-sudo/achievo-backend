const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const {
  getStats, getRecentActivity, getBusinesses, toggleBusiness,
  getUsers, verifyUser, getCities, createCity, updateCity, toggleCity, getDailyChart,
} = require('../controllers/adminController');
const { getTemplates, createTemplate, updateTemplate, deleteTemplate, toggleTemplate } = require('../controllers/templateController');

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

router.get('/templates',              ...guard, getTemplates);
router.post('/templates',             ...guard, createTemplate);
router.put('/templates/:id',          ...guard, updateTemplate);
router.delete('/templates/:id',       ...guard, deleteTemplate);
router.put('/templates/:id/toggle',   ...guard, toggleTemplate);

module.exports = router;
