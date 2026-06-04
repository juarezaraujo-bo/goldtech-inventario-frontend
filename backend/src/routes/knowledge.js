const express = require('express');
const router = express.Router();
const knowledgeController = require('../controllers/knowledgeController');
const { authMiddleware, adminMiddleware, goldtechTeamMiddleware } = require('../middleware/auth');

router.use(authMiddleware);
router.use(goldtechTeamMiddleware);

router.get('/articles', knowledgeController.getArticles);
router.get('/articles/:id', knowledgeController.getArticleById);
router.post('/articles', knowledgeController.createArticle);
router.put('/articles/:id', knowledgeController.updateArticle);
router.delete('/articles/:id', adminMiddleware, knowledgeController.deleteArticle);

module.exports = router;
