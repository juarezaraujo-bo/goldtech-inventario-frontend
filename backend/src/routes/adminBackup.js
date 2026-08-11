const express = require('express');
const fs = require('fs');
const path = require('path');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = express.Router();
const dbPath = path.resolve(__dirname, '../../../database/inventory.sqlite');

function buildBackupFileName() {
  const now = new Date();
  const parts = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0')
  ];

  return `goldtech-inventario-backup-${parts[0]}-${parts[1]}-${parts[2]}-${parts[3]}-${parts[4]}.sqlite`;
}

router.get('/backup/database', authMiddleware, adminMiddleware, (req, res) => {
  console.log(`[ADMIN-BACKUP] Backup do banco solicitado por usuario ${req.user?.id || 'desconhecido'}`);

  if (!fs.existsSync(dbPath)) {
    return res.status(404).json({ message: 'Arquivo de banco de dados não encontrado' });
  }

  const stats = fs.statSync(dbPath);
  const fileName = buildBackupFileName();

  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.setHeader('Content-Length', stats.size);

  const fileStream = fs.createReadStream(dbPath);

  fileStream.on('error', (error) => {
    console.error('[ADMIN-BACKUP] Erro no stream do backup:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Erro ao gerar backup do banco' });
    } else {
      res.destroy(error);
    }
  });

  fileStream.pipe(res);
});

module.exports = router;