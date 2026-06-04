const { db } = require('../models/db');

exports.getAll = (req, res) => {
  const query = `
    SELECT c.*,
      (SELECT COUNT(*) FROM equipments e WHERE e.client_id = c.id) AS equipment_count
    FROM clients c
    ORDER BY CASE WHEN c.status = 'Inativo' THEN 1 ELSE 0 END, c.name ASC
  `;
  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json(rows);
  });
};

exports.getById = (req, res) => {
  const { id } = req.params;
  db.get("SELECT * FROM clients WHERE id = ?", [id], (err, row) => {
    if (err) return res.status(500).json({ message: err.message });
    if (!row) return res.status(404).json({ message: "Cliente não encontrado" });
    res.json(row);
  });
};

exports.create = (req, res) => {
  const { name, cnpj, contact_person, phone, email, address, observations, status } = req.body;
  const normalizedName = (name || '').trim();

  if (!normalizedName) {
    return res.status(400).json({ message: 'Nome do cliente e obrigatorio.' });
  }

  db.get("SELECT id, status FROM clients WHERE lower(trim(name)) = lower(trim(?))", [normalizedName], (err, existing) => {
    if (err) return res.status(500).json({ message: err.message });
    if (existing) {
      return res.status(409).json({
        message: existing.status === 'Inativo'
          ? 'Ja existe um cliente inativo com este nome. Reative-o antes de criar outro.'
          : 'Ja existe um cliente com este nome.',
        client_id: existing.id,
        status: existing.status
      });
    }

    const query = `INSERT INTO clients (name, cnpj, contact_person, phone, email, address, observations, status) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    
    db.run(query, [normalizedName, cnpj, contact_person, phone, email, address, observations, status || 'Ativo'], function(err) {
      if (err) return res.status(500).json({ message: err.message });
      res.status(201).json({ id: this.lastID, ...req.body, name: normalizedName });
    });
  });
};

exports.update = (req, res) => {
  const { id } = req.params;
  const { name, cnpj, contact_person, phone, email, address, observations, status } = req.body;
  const normalizedName = (name || '').trim();

  if (!normalizedName) {
    return res.status(400).json({ message: 'Nome do cliente e obrigatorio.' });
  }

  db.get("SELECT id FROM clients WHERE id <> ? AND lower(trim(name)) = lower(trim(?))", [id, normalizedName], (err, existing) => {
    if (err) return res.status(500).json({ message: err.message });
    if (existing) return res.status(409).json({ message: 'Ja existe outro cliente com este nome.' });

    const query = `UPDATE clients SET name = ?, cnpj = ?, contact_person = ?, phone = ?, email = ?, 
                   address = ?, observations = ?, status = ? WHERE id = ?`;
    
    db.run(query, [normalizedName, cnpj, contact_person, phone, email, address, observations, status || 'Ativo', id], function(err) {
      if (err) return res.status(500).json({ message: err.message });
      if (this.changes === 0) return res.status(404).json({ message: 'Cliente nao encontrado' });
      res.json({ message: "Cliente atualizado" });
    });
  });
};

exports.delete = (req, res) => {
  const { id } = req.params;
  db.run('UPDATE clients SET status = ? WHERE id = ?', ['Inativo', id], function(err) {
    if (err) return res.status(500).json({ success: false, message: err.message });
    if (this.changes === 0) return res.status(404).json({ success: false, message: 'Cliente nao encontrado' });
    res.json({
      success: true,
      message: 'Cliente desativado com sucesso. O registro foi preservado no historico.',
      status: 'Inativo'
    });
  });
};

exports.setStatus = (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!status || !['Ativo', 'Inativo'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Status inválido. Use "Ativo" ou "Inativo".' });
  }
  db.run('UPDATE clients SET status = ? WHERE id = ?', [status, id], function(err) {
    if (err) return res.status(500).json({ success: false, message: err.message });
    if (this.changes === 0) return res.status(404).json({ success: false, message: 'Cliente não encontrado' });
    res.json({ success: true, message: `Cliente ${status === 'Ativo' ? 'reativado' : 'desativado'} com sucesso`, status });
  });
};

exports.getInventoryStats = (req, res) => {
  const { id } = req.params;
  const query = `
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN categoria = 'Ativos de Rede' THEN 1 ELSE 0 END) as network,
      SUM(CASE WHEN categoria = 'Desktops' THEN 1 ELSE 0 END) as desktops,
      SUM(CASE WHEN categoria = 'Notebooks' THEN 1 ELSE 0 END) as notebooks,
      SUM(CASE WHEN categoria = 'Servidores' THEN 1 ELSE 0 END) as servers,
      SUM(CASE WHEN categoria = 'Roteadores' THEN 1 ELSE 0 END) as routers,
      SUM(CASE WHEN status = 'Manutenção' THEN 1 ELSE 0 END) as maintenance,
      SUM(CASE WHEN ultima_coleta IS NULL OR ultima_coleta = '' THEN 1 ELSE 0 END) as no_collection
    FROM equipments WHERE client_id = ?
  `;
  
  db.get(query, [id], (err, row) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json(row);
  });
};

exports.getAgentPackage = (req, res) => {
  const { id } = req.params;
  const path = require('path');
  const fs = require('fs');
  const AdmZip = require('adm-zip');

  db.get("SELECT name FROM clients WHERE id = ?", [id], (err, client) => {
    if (err) return res.status(500).json({ message: err.message });
    if (!client) return res.status(404).json({ message: "Cliente não encontrado" });

    const clientName = client.name;
    const host = req.get('host');
    const forwardedProto = (req.get('x-forwarded-proto') || '').split(',')[0].trim();
    const protocol = (host || '').includes('onrender.com') ? 'https' : (forwardedProto || req.protocol);
    const apiUrl = process.env.PUBLIC_API_URL || `${protocol}://${host}`;
    const agentToken = process.env.AGENT_TOKEN || "goldtech_agent_secure_token_2026";
    
    try {
      const zip = new AdmZip();
      const bundledAgentDir = path.join(__dirname, '../agent');
      const legacyAgentDir = path.join(__dirname, '../../../agent');
      const agentDir = fs.existsSync(bundledAgentDir) ? bundledAgentDir : legacyAgentDir;
      
      const files = [
        'windows-inventory.ps1',
        'windows-performance.ps1',
        'install-inventory-task.ps1',
        'install-performance-task.ps1'
      ];

      files.forEach(fileName => {
        let content = fs.readFileSync(path.join(agentDir, fileName), 'utf8');
        
        const endpoint = fileName.includes('inventory') ? 'inventory' : 'performance';
        
        // Substituições ultra-específicas para não quebrar a lógica interna dos scripts
        if (fileName.includes('windows-')) {
          // No script de coleta, alteramos as variáveis de configuração no topo
          content = content.replace(/\$ApiUrl\s*=\s*['"][^'"]*['"]/, `$ApiUrl = "${apiUrl}/api/agent/${endpoint}"`);
          content = content.replace(/\$API_URL\s*=\s*['"][^'"]*['"]/, `$API_URL = "${apiUrl}/api/agent/${endpoint}"`);
          content = content.replace(/\$AgentToken\s*=\s*['"][^'"]*['"]/, `$AgentToken = "${agentToken}"`);
          content = content.replace(/\$AGENT_TOKEN\s*=\s*['"][^'"]*['"]/, `$AGENT_TOKEN = "${agentToken}"`);
          content = content.replace(/\$Cliente\s*=\s*['"][^'"]*['"]/, `$Cliente = "${clientName}"`);
        }
        
        if (fileName.includes('install-')) {
          // No instalador de tarefa, alteramos APENAS os parâmetros padrão no bloco param()
          content = content.replace(/\[string\]\$ApiUrl\s*=\s*['"][^'"]*['"]/, `[string]$ApiUrl = "${apiUrl}/api/agent/${endpoint}"`);
          content = content.replace(/\[string\]\$AgentToken\s*=\s*['"][^'"]*['"]/, `[string]$AgentToken = "${agentToken}"`);
          content = content.replace(/\[string\]\$Cliente\s*=\s*['"][^'"]*['"]/, `[string]$Cliente = "${clientName}"`);
        }

        zip.addFile(fileName, Buffer.from(content, 'utf8'));
      });

      // Gerar instalar-agente.bat com validação rigorosa de erro
      const batContent = `@echo off
setlocal enabledelayedexpansion
title Instalador Agente Goldtech - ${clientName}

echo ==========================================
echo GOLDTECH - Instalador de Agente
echo Cliente: ${clientName}
echo ==========================================
echo.

:: Verificar Privilegios de Admin
net session >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Este script precisa ser executado como ADMINISTRADOR.
    echo Clique com o botao direito e selecione 'Executar como Administrador'.
    pause
    exit /b 1
)

cd /d %~dp0

echo 1/4 - Rodando coleta de INVENTARIO inicial...
powershell -ExecutionPolicy Bypass -File windows-inventory.ps1
if !ERRORLEVEL! NEQ 0 (
    echo.
    echo [FALHA] Erro na coleta de inventario. Verifique logs ou conexao.
    pause
    exit /b 1
)
echo [OK] Inventario enviado.
echo.

echo 2/4 - Rodando coleta de PERFORMANCE inicial...
powershell -ExecutionPolicy Bypass -File windows-performance.ps1
if !ERRORLEVEL! NEQ 0 (
    echo.
    echo [FALHA] Erro na coleta de performance.
    pause
    exit /b 1
)
echo [OK] Performance enviada.
echo.

echo 3/4 - Agendando tarefa de INVENTARIO (Semanal)...
powershell -ExecutionPolicy Bypass -File install-inventory-task.ps1
if !ERRORLEVEL! NEQ 0 (
    echo.
    echo [FALHA] Erro ao criar tarefa de inventario.
    pause
    exit /b 1
)
echo [OK] Tarefa de inventario agendada.
echo.

echo 4/4 - Agendando tarefa de PERFORMANCE (Monitoramento)...
powershell -ExecutionPolicy Bypass -File install-performance-task.ps1
if !ERRORLEVEL! NEQ 0 (
    echo.
    echo [FALHA] Erro ao criar tarefa de performance.
    pause
    exit /b 1
)
echo [OK] Tarefa de performance agendada.
echo.

echo ==========================================
echo INSTALACAO CONCLUIDA COM SUCESSO!
echo O agente ja esta monitorando esta maquina.
echo ==========================================
pause`;
      zip.addFile('instalar-agente.bat', Buffer.from(batContent, 'utf8'));

      const readmeContent = `GOLDTECH INVENTÁRIO - AGENTE DE COLETA

Instruções de Instalação:

1. Extraia todos os arquivos em uma pasta na máquina destino (ex: C:\\GoldtechAgent).
2. Clique com o botão direito em "instalar-agente.bat" e selecione "Executar como Administrador".
3. Aguarde a finalização dos processos.

Arquivos no pacote:
- windows-inventory.ps1: Script de coleta de hardware e software.
- windows-performance.ps1: Script de monitoramento de recursos (CPU/RAM/Disco).
- install-inventory-task.ps1: Configura a tarefa agendada semanal.
- install-performance-task.ps1: Configura a tarefa agendada de monitoramento contínuo.
- instalar-agente.bat: Automatiza a instalação completa.

Suporte: contato@goldtech.com.br`;
      zip.addFile('README.txt', Buffer.from(readmeContent, 'utf8'));

      const buffer = zip.toBuffer();
      const fileNameZip = `Agente_Goldtech_${clientName.replace(/[^a-z0-9]/gi, '_')}.zip`;

      res.set({
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${fileNameZip}"`,
        'Content-Length': buffer.length
      });

      res.send(buffer);
    } catch (error) {
      console.error("Erro ao gerar pacote:", error);
      res.status(500).json({ message: "Erro ao gerar pacote do agente" });
    }
  });
};
