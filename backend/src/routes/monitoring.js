const express = require('express');
const router = express.Router();
const monitoringController = require('../controllers/monitoringController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/summary', monitoringController.getMonitoringSummary);

module.exports = router;
