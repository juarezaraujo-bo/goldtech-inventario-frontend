const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { db } = require('../models/db');
const { authMiddleware } = require('../middleware/auth');
const scannerService = require('../scanner/services/scannerPackageService');

// Todos os endpoints abaixo necessitam de autenticação
router.use(authMiddleware);

// Helper function para executar consultas usando Promises
const queryGet = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => {
    if (err) reject(err);
    else resolve(row);
  });
});

const queryAll = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => {
    if (err) reject(err);
    else resolve(rows);
  });
});

const queryRun = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function(err) {
    if (err) reject(err);
    else resolve(this);
  });
});

// Middleware para verificar se o cliente existe
async function checkClientExists(req, res, next) {
  const { clientId } = req.params;
  try {
    const client = await queryGet('SELECT id, name FROM clients WHERE id = ?', [clientId]);
    if (!client) {
      return res.status(404).json({ message: 'Cliente não encontrado.' });
    }
    req.client = client;
    next();
  } catch (error) {
    console.error('Erro ao verificar cliente:', error);
    return res.status(500).json({ message: 'Erro interno do servidor ao verificar cliente.' });
  }
}

/**
 * GET /api/clients/:clientId/security-diagnostic/config
 * Retorna as configurações do scanner para um determinado cliente.
 */
router.get('/clients/:clientId/security-diagnostic/config', checkClientExists, async (req, res) => {
  try {
    let config = await queryGet('SELECT * FROM client_scanner_configs WHERE client_id = ?', [req.client.id]);
    
    // Se não existir, retorna as configurações default sem salvar no banco de dados ainda
    if (!config) {
      config = {
        client_id: req.client.id,
        scanner_version: '0.1',
        mode: 'single',
        allowlist_json: '[]',
        sensitive_processes_json: '[]',
        notes: ''
      };
    }
    
    return res.json(config);
  } catch (error) {
    console.error('Erro ao buscar configuração do scanner:', error);
    return res.status(500).json({ message: 'Erro interno ao buscar configuração.' });
  }
});

/**
 * PUT /api/clients/:clientId/security-diagnostic/config
 * Atualiza ou cria as configurações do scanner para o cliente.
 */
router.put('/clients/:clientId/security-diagnostic/config', checkClientExists, async (req, res) => {
  const { scanner_version, mode, allowlist_json, sensitive_processes_json, notes } = req.body;
  const finalScannerVersion = scanner_version || '0.1';
  const finalMode = mode || 'single';
  const finalAllowlist = allowlist_json || '[]';
  const finalSensitiveProcesses = sensitive_processes_json || '[]';
  const finalNotes = notes || '';

  // Validar modo
  if (!scannerService.validateMode(finalMode)) {
    return res.status(400).json({ message: 'Modo inválido. Valores aceitos: single, continuous, scheduled.' });
  }

  // Validar JSON de allowlist
  try {
    JSON.parse(finalAllowlist);
  } catch (e) {
    return res.status(400).json({ message: 'allowlist_json inválido. Precisa ser uma string JSON válida de array.' });
  }

  // Validar JSON de processos sensíveis
  try {
    JSON.parse(finalSensitiveProcesses);
  } catch (e) {
    return res.status(400).json({ message: 'sensitive_processes_json inválido. Precisa ser uma string JSON válida de array.' });
  }

  try {
    const existing = await queryGet('SELECT id FROM client_scanner_configs WHERE client_id = ?', [req.client.id]);
    
    if (existing) {
      await queryRun(
        `UPDATE client_scanner_configs 
         SET scanner_version = ?, mode = ?, allowlist_json = ?, sensitive_processes_json = ?, notes = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE client_id = ?`,
        [finalScannerVersion, finalMode, finalAllowlist, finalSensitiveProcesses, finalNotes, req.client.id]
      );
    } else {
      await queryRun(
        `INSERT INTO client_scanner_configs (client_id, scanner_version, mode, allowlist_json, sensitive_processes_json, notes) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [req.client.id, finalScannerVersion, finalMode, finalAllowlist, finalSensitiveProcesses, finalNotes]
      );
    }

    const updatedConfig = await queryGet('SELECT * FROM client_scanner_configs WHERE client_id = ?', [req.client.id]);
    return res.json(updatedConfig);
  } catch (error) {
    console.error('Erro ao atualizar configuração do scanner:', error);
    return res.status(500).json({ message: 'Erro interno ao salvar configuração.' });
  }
});

/**
 * GET /api/clients/:clientId/security-diagnostic/packages
 * Lista os pacotes gerados para o cliente.
 */
router.get('/clients/:clientId/security-diagnostic/packages', checkClientExists, async (req, res) => {
  try {
    const packages = await queryAll(
      'SELECT id, client_id, config_id, scanner_version, mode, filename, sha256, size_bytes, generated_by, created_at FROM scanner_packages WHERE client_id = ? ORDER BY created_at DESC',
      [req.client.id]
    );
    return res.json(packages);
  } catch (error) {
    console.error('Erro ao listar pacotes do scanner:', error);
    return res.status(500).json({ message: 'Erro interno ao listar pacotes.' });
  }
});

/**
 * POST /api/clients/:clientId/security-diagnostic/packages
 * Gera um novo pacote ZIP do scanner para download manual.
 */
router.post('/clients/:clientId/security-diagnostic/packages', checkClientExists, async (req, res) => {
  try {
    // 1. Obter ou criar configuração default
    let config = await queryGet('SELECT * FROM client_scanner_configs WHERE client_id = ?', [req.client.id]);
    if (!config) {
      // Cria a configuração default no banco de dados para vincular ao pacote
      await queryRun(
        `INSERT INTO client_scanner_configs (client_id, scanner_version, mode, allowlist_json, sensitive_processes_json, notes) 
         VALUES (?, '0.1', 'single', '[]', '[]', '')`,
        [req.client.id]
      );
      config = await queryGet('SELECT * FROM client_scanner_configs WHERE client_id = ?', [req.client.id]);
    }

    // 2. Obter nome do usuário que solicitou a geração
    let userName = 'Sistema';
    if (req.userId) {
      const user = await queryGet('SELECT name FROM users WHERE id = ?', [req.userId]);
      if (user) {
        userName = user.name;
      }
    }

    // 3. Chamar o serviço para gerar o ZIP física e logicamente
    let packageResult;
    try {
      packageResult = await scannerService.generatePackage(config, req.client, userName);
    } catch (zipError) {
      // Tratar o erro amigável se a pasta de templates estiver vazia ou não existir
      return res.status(400).json({ message: zipError.message });
    }

    // 4. Salvar registro no banco de dados
    const insertResult = await queryRun(
      `INSERT INTO scanner_packages (client_id, config_id, scanner_version, mode, filename, file_path, sha256, size_bytes, generated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        packageResult.client_id,
        packageResult.config_id,
        packageResult.scanner_version,
        packageResult.mode,
        packageResult.filename,
        packageResult.file_path,
        packageResult.sha256,
        packageResult.size_bytes,
        packageResult.generated_by
      ]
    );

    const savedPackage = await queryGet('SELECT id, client_id, config_id, scanner_version, mode, filename, sha256, size_bytes, generated_by, created_at FROM scanner_packages WHERE id = ?', [insertResult.lastID]);
    return res.status(201).json(savedPackage);
  } catch (error) {
    console.error('Erro ao gerar pacote do scanner:', error);
    return res.status(500).json({ message: 'Erro interno ao gerar pacote.' });
  }
});

/**
 * GET /api/clients/:clientId/security-diagnostic/packages/:packageId/download
 * Permite baixar o arquivo ZIP gerado.
 */
router.get('/clients/:clientId/security-diagnostic/packages/:packageId/download', checkClientExists, async (req, res) => {
  const { packageId } = req.params;
  try {
    const pkg = await queryGet('SELECT * FROM scanner_packages WHERE id = ? AND client_id = ?', [packageId, req.client.id]);
    if (!pkg) {
      return res.status(404).json({ message: 'Pacote não encontrado.' });
    }

    const absolutePath = path.resolve(pkg.file_path);

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ message: 'Arquivo físico do pacote não encontrado no servidor.' });
    }

    // Envia o arquivo lendo diretamente com fs e pipe para ser compatível com Express 5 no Windows
    const stat = fs.statSync(absolutePath);
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${pkg.filename}"`,
      'Content-Length': stat.size
    });
    const fileStream = fs.createReadStream(absolutePath);
    fileStream.on('error', (err) => {
      console.error('Erro ao ler arquivo para download:', err);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Erro ao ler arquivo para download.' });
      }
    });
    return fileStream.pipe(res);
  } catch (error) {
    console.error('Erro ao baixar pacote do scanner:', error);
    return res.status(500).json({ message: 'Erro interno ao processar download.' });
  }
});

/**
 * DELETE /api/clients/:clientId/security-diagnostic/packages/:packageId
 * Remove o pacote fisicamente e exclui o registro do banco de dados.
 */
router.delete('/clients/:clientId/security-diagnostic/packages/:packageId', checkClientExists, async (req, res) => {
  const { packageId } = req.params;
  try {
    const pkg = await queryGet('SELECT * FROM scanner_packages WHERE id = ? AND client_id = ?', [packageId, req.client.id]);
    if (!pkg) {
      return res.status(404).json({ message: 'Pacote não encontrado.' });
    }

    // Remover arquivo do disco
    scannerService.deletePackageFile(pkg.file_path);

    // Remover do banco
    await queryRun('DELETE FROM scanner_packages WHERE id = ?', [packageId]);

    return res.json({ message: 'Pacote excluído com sucesso.' });
  } catch (error) {
    console.error('Erro ao excluir pacote do scanner:', error);
    return res.status(500).json({ message: 'Erro interno ao excluir pacote.' });
  }
});

module.exports = router;
