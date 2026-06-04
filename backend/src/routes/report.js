const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/stats', reportController.getGeneralStats);
router.get('/analytical', reportController.getAnalyticalReports);
router.get('/export-csv', reportController.exportCsv);

module.exports = router;
