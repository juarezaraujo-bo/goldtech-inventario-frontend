const express = require('express');
const router = express.Router();
const equipmentController = require('../controllers/equipmentController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// Middleware de autenticação para todas as rotas abaixo
router.use(authMiddleware);

// Rotas de mutação de campo específico
router.patch('/:id/move', equipmentController.move);
router.patch('/:id/category', equipmentController.updateCategory);

router.get('/', equipmentController.getAll);

router.get('/stats', equipmentController.getStats);
router.get('/export', equipmentController.exportCsv);
router.get('/:id', equipmentController.getById);
router.post('/', equipmentController.create);
router.put('/:id', equipmentController.update);
router.delete('/:id', adminMiddleware, equipmentController.delete);

router.get('/:id/maintenance', equipmentController.getMaintenance);
router.post('/:id/maintenance', equipmentController.addMaintenance);
router.get('/:id/performance', equipmentController.getPerformance);

module.exports = router;
