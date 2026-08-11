const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', clientController.getAll);
router.get('/:id/stats', clientController.getInventoryStats);
router.get('/:id/export/inventory/:format', clientController.exportInventory);
router.get('/:id/export/network-assets/:format', clientController.exportNetworkDiscoveredAssets);
router.get('/:id/export/documentation/json', clientController.exportDocumentation);
router.get('/:id/network-discovered-assets', clientController.getNetworkDiscoveredAssets);
router.post('/:id/network-discovered-assets/import-bulk', clientController.importNetworkDiscoveredAssetsBulk);
router.post('/:id/network-discovered-assets/:assetId/import', clientController.importNetworkDiscoveredAsset);
router.post('/:id/network-discovered-assets/:assetId/ignore', clientController.ignoreNetworkDiscoveredAsset);
router.get('/:id/agent-package', clientController.getAgentPackage);
router.get('/:id', clientController.getById);
router.post('/', clientController.create);
router.put('/:id', clientController.update);
router.patch('/:id/status', adminMiddleware, clientController.setStatus);
router.delete('/:id', adminMiddleware, clientController.delete);

module.exports = router;
