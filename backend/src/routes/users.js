const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// Todas as rotas exigem autenticação
router.use(authMiddleware);

// Listar usuários — qualquer autenticado
router.get('/', adminMiddleware, userController.getAll);

// Alterar própria senha — qualquer autenticado
router.put('/change-password', userController.changePassword);

// Criar, editar e excluir — apenas admin
router.post('/', adminMiddleware, userController.create);
router.put('/:id', adminMiddleware, userController.update);
router.put('/:id/password', adminMiddleware, userController.setPassword);
router.delete('/:id', adminMiddleware, userController.remove);

module.exports = router;
