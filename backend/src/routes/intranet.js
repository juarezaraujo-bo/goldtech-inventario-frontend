const express = require('express');
const router = express.Router();
const intranetController = require('../controllers/intranetController');
const { authMiddleware, adminMiddleware, goldtechTeamMiddleware } = require('../middleware/auth');

router.use(authMiddleware);
router.use(goldtechTeamMiddleware);

router.get('/documents', intranetController.getDocuments);
router.get('/documents/:id', intranetController.getDocumentById);
router.post('/documents', intranetController.createDocument);
router.put('/documents/:id', intranetController.updateDocument);
router.delete('/documents/:id', adminMiddleware, intranetController.deleteDocument);

module.exports = router;
