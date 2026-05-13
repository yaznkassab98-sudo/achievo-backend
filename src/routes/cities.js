const router = require('express').Router();
const { getCities } = require('../controllers/cityController');

router.get('/', getCities);

module.exports = router;
