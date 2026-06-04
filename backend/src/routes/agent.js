const express = require('express');
const router = express.Router();
const agentController = require('../controllers/agentController');
const { agentAuthMiddleware } = require('../middleware/agentAuth');

// Todas as rotas do agente exigem x-agent-token no header
router.get('/test', agentAuthMiddleware, agentController.test);
router.post('/inventory', agentAuthMiddleware, agentController.collect);
router.post('/performance', agentAuthMiddleware, agentController.collectPerformance);

module.exports = router;

