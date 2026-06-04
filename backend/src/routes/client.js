const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', clientController.getAll);
router.get('/:id', clientController.getById);
router.get('/:id/stats', clientController.getInventoryStats);
router.get('/:id/agent-package', clientController.getAgentPackage);
router.post('/', clientController.create);
router.put('/:id', clientController.update);
router.patch('/:id/status', adminMiddleware, clientController.setStatus);
router.delete('/:id', adminMiddleware, clientController.delete);

module.exports = router;
