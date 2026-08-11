const { db } = require('../models/db');
const { parse } = require('json2csv');
const { classifyNetworkAsset } = require('../utils/networkAssetClassifier');

function ensureNetworkDiscoveredAssetsTable(callback) {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS network_discovered_assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      ip_address TEXT NOT NULL,
      mac_address TEXT,
      hostname TEXT,
      vendor TEXT,
      device_type TEXT DEFAULT 'unknown',
      printer_model TEXT,
      open_ports TEXT,
      detection_method TEXT,
      is_collector INTEGER DEFAULT 0,
      collector_hostname TEXT,
      local_ip TEXT,
      interface_alias TEXT,
      already_in_inventory INTEGER DEFAULT 0,
      equipment_id INTEGER,
      documentation_status TEXT DEFAULT 'pending',
      documentation_ref_id INTEGER,
      imported_at DATETIME,
      first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'active',
      notes TEXT,
      FOREIGN KEY (client_id) REFERENCES clients (id)
    )`, (err) => {
      if (err) return callback(err);

      db.run(`CREATE INDEX IF NOT EXISTS idx_network_discovered_assets_client
        ON network_discovered_assets (client_id)`, (indexErr) => {
        if (indexErr) return callback(indexErr);

        db.run(`CREATE INDEX IF NOT EXISTS idx_network_discovered_assets_client_ip
          ON network_discovered_assets (client_id, ip_address)`, (ipIndexErr) => {
          if (ipIndexErr) return callback(ipIndexErr);

          db.run(`CREATE INDEX IF NOT EXISTS idx_network_discovered_assets_client_mac
            ON network_discovered_assets (client_id, mac_address)`, (macIndexErr) => {
            if (macIndexErr) return callback(macIndexErr);
            ensureNetworkDiscoveryImportColumns(callback);
          });
        });
      });
    });
  });
}

function ensureNetworkDiscoveryImportColumns(callback) {
  db.all(`PRAGMA table_info(network_discovered_assets)`, [], (err, rows = []) => {
    if (err) return callback(err);

    const columns = new Set(rows.map((row) => row.name));
    const statements = [];
    if (!columns.has('documentation_status')) {
      statements.push(`ALTER TABLE network_discovered_assets ADD COLUMN documentation_status TEXT DEFAULT 'pending'`);
    }
    if (!columns.has('documentation_ref_id')) {
      statements.push(`ALTER TABLE network_discovered_assets ADD COLUMN documentation_ref_id INTEGER`);
    }
    if (!columns.has('imported_at')) {
      statements.push(`ALTER TABLE network_discovered_assets ADD COLUMN imported_at DATETIME`);
    }
    if (!columns.has('is_collector')) {
      statements.push(`ALTER TABLE network_discovered_assets ADD COLUMN is_collector INTEGER DEFAULT 0`);
    }
    if (!columns.has('collector_hostname')) {
      statements.push(`ALTER TABLE network_discovered_assets ADD COLUMN collector_hostname TEXT`);
    }
    if (!columns.has('local_ip')) {
      statements.push(`ALTER TABLE network_discovered_assets ADD COLUMN local_ip TEXT`);
    }
    if (!columns.has('interface_alias')) {
      statements.push(`ALTER TABLE network_discovered_assets ADD COLUMN interface_alias TEXT`);
    }
    if (!columns.has('already_in_inventory')) {
      statements.push(`ALTER TABLE network_discovered_assets ADD COLUMN already_in_inventory INTEGER DEFAULT 0`);
    }
    if (!columns.has('equipment_id')) {
      statements.push(`ALTER TABLE network_discovered_assets ADD COLUMN equipment_id INTEGER`);
    }

    const runNext = () => {
      const statement = statements.shift();
      if (!statement) return callback();
      db.run(statement, (alterErr) => {
        if (alterErr) return callback(alterErr);
        runNext();
      });
    };

    runNext();
  });
}

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

exports.getNetworkDiscoveredAssets = (req, res) => {
  const { id } = req.params;
  const clientId = Number(id);

  if (!clientId) {
    return res.status(400).json({ message: 'Cliente invalido.' });
  }

  const query = `
    SELECT
      id,
      client_id,
      ip_address,
      mac_address,
      hostname,
      vendor,
      device_type,
      printer_model,
      open_ports,
      detection_method,
      is_collector,
      collector_hostname,
      local_ip,
      interface_alias,
      already_in_inventory,
      equipment_id,
      documentation_status,
      documentation_ref_id,
      imported_at,
      first_seen,
      last_seen,
      status,
      notes
    FROM network_discovered_assets
    WHERE client_id = ?
    ORDER BY datetime(last_seen) DESC, ip_address ASC
  `;

  ensureNetworkDiscoveredAssetsTable((tableErr) => {
    if (tableErr) {
      console.error(`[NETWORK-ASSETS] Falha ao garantir tabela: ${tableErr.message}`);
      return res.status(500).json({ message: 'Falha ao carregar ativos descobertos.' });
    }

    db.all(query, [clientId], (err, rows = []) => {
      if (err) {
        console.error(`[NETWORK-ASSETS] Falha ao listar ativos do cliente ${clientId}: ${err.message}`);
        return res.status(500).json({ message: 'Falha ao carregar ativos descobertos.' });
      }

      const assets = rows.map((row) => {
        let openPorts = [];
        try {
          openPorts = row.open_ports ? JSON.parse(row.open_ports) : [];
        } catch {
          openPorts = [];
        }

        const classified = classifyNetworkAsset({
          ...row,
          open_ports: openPorts
        });

        const normalizedOpenPortsJson = JSON.stringify(classified.open_ports);
        const currentOpenPortsJson = JSON.stringify(Array.isArray(openPorts) ? openPorts : []);
        const detectionMethod = appendDetectionMethods(
          row.detection_method,
          classified.device_type === 'media_device' ? ['probable-iot', 'probable-media-device'] : []
        );
        if (
          row.device_type !== classified.device_type ||
          (row.printer_model || null) !== (classified.printer_model || null) ||
          currentOpenPortsJson !== normalizedOpenPortsJson ||
          (row.detection_method || null) !== (detectionMethod || null)
        ) {
          db.run(
            `UPDATE network_discovered_assets
             SET device_type = ?, printer_model = ?, open_ports = ?, detection_method = ?
             WHERE id = ?`,
            [classified.device_type, classified.printer_model, normalizedOpenPortsJson, detectionMethod, row.id],
            (updateErr) => {
              if (updateErr) {
                console.error(`[NETWORK-ASSETS] Falha ao reclassificar ativo ${row.id}: ${updateErr.message}`);
              }
            }
          );
        }

        return {
          ...row,
          device_type: classified.device_type,
          printer_model: classified.printer_model,
          open_ports: classified.open_ports,
          detection_method: detectionMethod,
          is_collector: Boolean(row.is_collector),
          already_in_inventory: Boolean(row.already_in_inventory || row.equipment_id)
        };
      });

      correlateNetworkAssetsWithInventory(clientId, assets, (correlationErr, enrichedAssets) => {
        if (correlationErr) {
          console.error(`[NETWORK-ASSETS] Falha ao cruzar inventario do cliente ${clientId}: ${correlationErr.message}`);
          return res.status(500).json({ message: 'Falha ao carregar ativos descobertos.' });
        }

        res.json(enrichedAssets);
      });
    });
  });
};

function appendDetectionMethods(current, methods = []) {
  const parts = String(current || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  for (const method of methods) {
    if (method && !parts.includes(method)) parts.push(method);
  }
  return parts.length ? parts.join(', ') : null;
}

function normalizeCompare(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeMacCompare(value) {
  return String(value || '').replace(/[^0-9a-f]/gi, '').toUpperCase();
}

function deviceTypeFromEquipment(equipment) {
  const text = normalizeCompare(`${equipment?.categoria || ''} ${equipment?.tipo || ''}`);
  if (text.includes('servidor')) return 'server';
  if (text.includes('impress')) return 'printer';
  if (text.includes('iot') || text.includes('multim') || text.includes('tv') || text.includes('videogame') || text.includes('streaming')) return 'media_device';
  if (text.includes('rede') || text.includes('roteador') || text.includes('switch') || text.includes('router')) return 'network_device';
  if (text.includes('desktop') || text.includes('notebook') || text.includes('laptop') || text.includes('esta')) return 'workstation';
  return null;
}

function findEquipmentMatch(asset, equipments) {
  const assetMac = normalizeMacCompare(asset.mac_address);
  const assetIp = normalizeCompare(asset.ip_address);
  const assetHost = normalizeCompare(asset.hostname);

  return equipments.find((equipment) => {
    const equipmentMac = normalizeMacCompare(equipment.mac);
    const equipmentIp = normalizeCompare(equipment.ip);
    const equipmentHost = normalizeCompare(equipment.nome);

    return (
      (assetMac && equipmentMac && assetMac === equipmentMac) ||
      (assetIp && equipmentIp && assetIp === equipmentIp) ||
      (assetHost && equipmentHost && assetHost === equipmentHost)
    );
  }) || null;
}

function correlateNetworkAssetsWithInventory(clientId, assets, callback) {
  db.all(
    `SELECT id, nome, categoria, tipo, fabricante, modelo, ip, mac
     FROM equipments
     WHERE client_id = ?`,
    [clientId],
    (err, equipments = []) => {
      if (err) return callback(err);

      const enrichedAssets = assets.map((asset) => {
        const match = findEquipmentMatch(asset, equipments);
        if (!match) {
          if (asset.already_in_inventory || asset.equipment_id) {
            db.run(
              `UPDATE network_discovered_assets
               SET already_in_inventory = 0, equipment_id = NULL
               WHERE id = ?`,
              [asset.id]
            );
          }
          return {
            ...asset,
            already_in_inventory: false,
            equipment_id: null
          };
        }

        const enriched = {
          ...asset,
          hostname: asset.hostname || match.nome || null,
          vendor: asset.vendor || match.fabricante || null,
          printer_model: asset.printer_model || (['printer', 'media_device'].includes(asset.device_type) ? match.modelo : null),
          device_type: asset.device_type && asset.device_type !== 'unknown'
            ? asset.device_type
            : (deviceTypeFromEquipment(match) || asset.device_type || 'unknown'),
          already_in_inventory: true,
          equipment_id: match.id
        };

        db.run(
          `UPDATE network_discovered_assets
           SET hostname = COALESCE(NULLIF(hostname, ''), ?),
               vendor = COALESCE(NULLIF(vendor, ''), ?),
               device_type = CASE WHEN device_type IS NULL OR device_type = '' OR device_type = 'unknown' THEN ? ELSE device_type END,
               printer_model = COALESCE(NULLIF(printer_model, ''), ?),
               already_in_inventory = 1,
               equipment_id = ?
           WHERE id = ?`,
          [
            match.nome || null,
            match.fabricante || null,
            deviceTypeFromEquipment(match) || enriched.device_type || 'unknown',
            ['printer', 'media_device'].includes(enriched.device_type) ? (match.modelo || null) : null,
            match.id,
            asset.id
          ]
        );

        return enriched;
      });

      callback(null, enrichedAssets);
    }
  );
}

function getDocumentationCategory(deviceType) {
  const categories = {
    printer: 'Impressoras',
    network_device: 'Rede',
    media_device: 'IoT / Multimídia',
    server: 'Servidores',
    workstation: 'Estações',
    unknown: 'Ativos Não Classificados'
  };
  return categories[deviceType] || categories.unknown;
}

function getDocumentationTitle(asset) {
  const typeLabel = {
    printer: 'Impressora',
    network_device: 'Ativo de Rede',
    media_device: 'IoT / Multimídia',
    server: 'Servidor',
    workstation: 'Estação',
    unknown: 'Ativo Não Classificado'
  }[asset.device_type] || 'Ativo Não Classificado';

  return `${typeLabel} - ${asset.hostname || asset.ip_address || asset.mac_address || `#${asset.id}`}`;
}

function buildDocumentationContent(asset) {
  const ports = Array.isArray(asset.open_ports) ? asset.open_ports.join(', ') : '';
  return [
    `Origem: Descoberta de Rede`,
    `Status: Ativo`,
    `Data de Importacao: ${new Date().toISOString()}`,
    ``,
    `IP: ${asset.ip_address || ''}`,
    `MAC: ${asset.mac_address || ''}`,
    `Hostname: ${asset.hostname || ''}`,
    `Tipo: ${asset.device_type || 'unknown'}`,
    `Fabricante: ${asset.vendor || ''}`,
    `Modelo: ${asset.printer_model || ''}`,
    `Portas: ${ports}`,
    `Metodo de Deteccao: ${asset.detection_method || ''}`,
    `Ultima vez visto: ${asset.last_seen || ''}`,
    `Observacoes: ${asset.notes || ''}`
  ].join('\n');
}

function getNetworkAssetById(clientId, assetId) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM network_discovered_assets WHERE client_id = ? AND id = ?`,
      [clientId, assetId],
      (err, row) => err ? reject(err) : resolve(row)
    );
  });
}

function findExistingDocumentation(asset) {
  const conditions = [];
  const params = [asset.client_id];

  if (asset.ip_address) {
    conditions.push('content LIKE ?');
    params.push(`%IP: ${asset.ip_address}%`);
  }
  if (asset.mac_address) {
    conditions.push('content LIKE ?');
    params.push(`%MAC: ${asset.mac_address}%`);
  }
  if (asset.hostname) {
    conditions.push('content LIKE ?');
    params.push(`%Hostname: ${asset.hostname}%`);
  }

  if (!conditions.length) return Promise.resolve(null);

  return new Promise((resolve, reject) => {
    db.get(
      `SELECT id FROM intranet_documents
       WHERE client_id = ? AND (${conditions.join(' OR ')})
       ORDER BY updated_at DESC, created_at DESC
       LIMIT 1`,
      params,
      (err, row) => err ? reject(err) : resolve(row)
    );
  });
}

function updateNetworkAssetDocumentationStatus(assetId, status, refId) {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE network_discovered_assets
       SET documentation_status = ?, documentation_ref_id = ?, imported_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [status, refId || null, assetId],
      function (err) {
        if (err) reject(err);
        else resolve(this);
      }
    );
  });
}

function ignoreNetworkAsset(clientId, assetId) {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE network_discovered_assets
       SET documentation_status = 'ignored', imported_at = CURRENT_TIMESTAMP
       WHERE client_id = ? AND id = ?`,
      [clientId, assetId],
      function (err) {
        if (err) reject(err);
        else resolve(this);
      }
    );
  });
}

async function importNetworkAssetToDocumentation(clientId, assetId, userId) {
  const rawAsset = await getNetworkAssetById(clientId, assetId);
  if (!rawAsset) {
    const error = new Error('Ativo descoberto nao encontrado.');
    error.statusCode = 404;
    throw error;
  }

  let openPorts = [];
  try {
    openPorts = rawAsset.open_ports ? JSON.parse(rawAsset.open_ports) : [];
  } catch {
    openPorts = [];
  }

  const classified = classifyNetworkAsset({ ...rawAsset, open_ports: openPorts });
  const asset = {
    ...rawAsset,
    device_type: classified.device_type,
    printer_model: classified.printer_model,
    open_ports: classified.open_ports
  };

  const title = getDocumentationTitle(asset);
  const category = getDocumentationCategory(asset.device_type);
  const content = buildDocumentationContent(asset);
  const existing = await findExistingDocumentation(asset);

  if (existing) {
    const result = await new Promise((resolve, reject) => {
      db.run(
        `UPDATE intranet_documents
         SET title = ?, category = ?, content = ?, visibility = 'base_cliente',
             updated_by = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [title, category, content, userId, existing.id],
        function (err) {
          if (err) reject(err);
          else resolve(this);
        }
      );
    });

    await updateNetworkAssetDocumentationStatus(asset.id, 'updated', existing.id);
    return { action: 'updated', document_id: existing.id, changes: result.changes };
  }

  const created = await new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO intranet_documents
       (client_id, title, category, content, visibility, created_by, updated_by)
       VALUES (?, ?, ?, ?, 'base_cliente', ?, ?)`,
      [clientId, title, category, content, userId, userId],
      function (err) {
        if (err) reject(err);
        else resolve(this);
      }
    );
  });

  await updateNetworkAssetDocumentationStatus(asset.id, 'imported', created.lastID);
  return { action: 'imported', document_id: created.lastID };
}

exports.importNetworkDiscoveredAsset = async (req, res) => {
  const clientId = Number(req.params.id);
  const assetId = Number(req.params.assetId);

  if (!clientId || !assetId) {
    return res.status(400).json({ message: 'Cliente ou ativo invalido.' });
  }

  ensureNetworkDiscoveredAssetsTable(async (tableErr) => {
    if (tableErr) return res.status(500).json({ message: 'Falha ao preparar importacao.' });

    try {
      const result = await importNetworkAssetToDocumentation(clientId, assetId, req.userId);
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(error.statusCode || 500).json({ message: error.message || 'Falha ao importar ativo.' });
    }
  });
};

exports.importNetworkDiscoveredAssetsBulk = async (req, res) => {
  const clientId = Number(req.params.id);
  const assetIds = Array.isArray(req.body?.asset_ids) ? req.body.asset_ids.map(Number).filter(Boolean) : [];

  if (!clientId || assetIds.length === 0) {
    return res.status(400).json({ message: 'Selecione ao menos um ativo para importar.' });
  }

  ensureNetworkDiscoveredAssetsTable(async (tableErr) => {
    if (tableErr) return res.status(500).json({ message: 'Falha ao preparar importacao.' });

    const results = [];
    for (const assetId of assetIds) {
      try {
        results.push({ asset_id: assetId, ...(await importNetworkAssetToDocumentation(clientId, assetId, req.userId)) });
      } catch (error) {
        results.push({ asset_id: assetId, error: error.message || 'Falha ao importar ativo.' });
      }
    }

    res.json({ success: true, results });
  });
};

exports.ignoreNetworkDiscoveredAsset = (req, res) => {
  const clientId = Number(req.params.id);
  const assetId = Number(req.params.assetId);

  if (!clientId || !assetId) {
    return res.status(400).json({ message: 'Cliente ou ativo invalido.' });
  }

  ensureNetworkDiscoveredAssetsTable(async (tableErr) => {
    if (tableErr) return res.status(500).json({ message: 'Falha ao preparar atualizacao.' });

    try {
      const result = await ignoreNetworkAsset(clientId, assetId);
      if (result.changes === 0) return res.status(404).json({ message: 'Ativo descoberto nao encontrado.' });
      res.json({ success: true, documentation_status: 'ignored' });
    } catch (error) {
      res.status(500).json({ message: 'Falha ao ignorar ativo.' });
    }
  });
};


const INVENTORY_EXPORT_FIELDS = [
  'id', 'client_id', 'client_name', 'nome', 'categoria', 'categoria_manual', 'tipo', 'fabricante', 'modelo',
  'numero_serie', 'patrimonio', 'usuario_responsavel', 'localizacao', 'setor', 'status', 'data_aquisicao',
  'garantia', 'observacoes', 'sistema_operacional', 'processador', 'memoria_ram', 'armazenamento',
  'disco_livre_gb', 'bios_versao', 'bios_data', 'placa_mae', 'data_instalacao_os', 'ultima_inicializacao',
  'ip', 'mac', 'dominio', 'antivirus', 'ultima_coleta', 'origem_cadastro'
];

const NETWORK_ASSET_EXPORT_FIELDS = [
  'id', 'client_id', 'ip_address', 'mac_address', 'hostname', 'vendor', 'device_type', 'printer_model',
  'open_ports', 'detection_method', 'is_collector', 'collector_hostname', 'local_ip', 'interface_alias',
  'already_in_inventory', 'equipment_id', 'documentation_status', 'documentation_ref_id', 'imported_at',
  'first_seen', 'last_seen', 'status', 'notes'
];

function normalizeExportFormat(format) {
  const normalized = String(format || '').toLowerCase();
  return ['csv', 'json'].includes(normalized) ? normalized : null;
}

function sanitizeFilenamePart(value) {
  return String(value || 'cliente')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'cliente';
}

function sendJsonDownload(res, filename, payload) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(JSON.stringify(payload, null, 2));
}

function sendCsvDownload(res, filename, rows, fields) {
  const csv = parse(rows || [], fields ? { fields } : undefined);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}

function findClientForExport(clientId, callback) {
  db.get('SELECT id, name, cnpj, status FROM clients WHERE id = ?', [clientId], (err, client) => {
    if (err) return callback(err);
    if (!client) {
      const notFound = new Error('Cliente nao encontrado.');
      notFound.statusCode = 404;
      return callback(notFound);
    }
    callback(null, client);
  });
}

function exportRowsByClient(req, res, options) {
  const clientId = Number(req.params.id);
  const format = normalizeExportFormat(req.params.format || options.format);

  if (!clientId) return res.status(400).json({ message: 'Cliente invalido.' });
  if (!format || !options.allowedFormats.includes(format)) {
    return res.status(400).json({ message: 'Formato de exportacao invalido.' });
  }

  findClientForExport(clientId, (clientErr, client) => {
    if (clientErr) return res.status(clientErr.statusCode || 500).json({ message: clientErr.message });

    const runQuery = () => {
      db.all(options.query, [clientId], (err, rows = []) => {
        if (err) return res.status(500).json({ message: 'Erro ao gerar exportacao.' });

        try {
          const preparedRows = options.mapRows ? options.mapRows(rows) : rows;
          const suffix = `${sanitizeFilenamePart(client.name)}-${options.fileLabel}`;
          if (format === 'json') {
            return sendJsonDownload(res, `${suffix}.json`, {
              exported_at: new Date().toISOString(),
              client,
              total: preparedRows.length,
              data: preparedRows
            });
          }
          return sendCsvDownload(res, `${suffix}.csv`, preparedRows, options.fields);
        } catch (exportErr) {
          console.error('[CLIENT-EXPORT] Falha ao preparar arquivo:', exportErr.message);
          return res.status(500).json({ message: 'Erro ao preparar arquivo de exportacao.' });
        }
      });
    };

    if (options.ensureTable) return options.ensureTable((tableErr) => {
      if (tableErr) return res.status(500).json({ message: 'Erro ao preparar dados para exportacao.' });
      runQuery();
    });

    runQuery();
  });
}

function parseOpenPortsForExport(rows) {
  return rows.map((row) => {
    let openPorts = [];
    try {
      openPorts = row.open_ports ? JSON.parse(row.open_ports) : [];
    } catch {
      openPorts = [];
    }
    return {
      ...row,
      open_ports: Array.isArray(openPorts) ? openPorts.join(', ') : ''
    };
  });
}

exports.exportInventory = (req, res) => {
  exportRowsByClient(req, res, {
    allowedFormats: ['csv', 'json'],
    fileLabel: 'inventario',
    fields: INVENTORY_EXPORT_FIELDS,
    query: `
      SELECT e.*, c.name AS client_name
      FROM equipments e
      JOIN clients c ON c.id = e.client_id
      WHERE e.client_id = ?
      ORDER BY e.nome ASC, e.id ASC
    `
  });
};

exports.exportNetworkDiscoveredAssets = (req, res) => {
  exportRowsByClient(req, res, {
    allowedFormats: ['csv', 'json'],
    fileLabel: 'ativos-descobertos',
    fields: NETWORK_ASSET_EXPORT_FIELDS,
    ensureTable: ensureNetworkDiscoveredAssetsTable,
    mapRows: parseOpenPortsForExport,
    query: `
      SELECT *
      FROM network_discovered_assets
      WHERE client_id = ?
      ORDER BY datetime(last_seen) DESC, ip_address ASC
    `
  });
};

exports.exportDocumentation = (req, res) => {
  exportRowsByClient(req, res, {
    allowedFormats: ['json'],
    format: 'json',
    fileLabel: 'documentacao-tecnica',
    query: `
      SELECT d.*, c.name AS client_name, creator.name AS created_by_name, updater.name AS updated_by_name
      FROM intranet_documents d
      JOIN clients c ON c.id = d.client_id
      LEFT JOIN users creator ON creator.id = d.created_by
      LEFT JOIN users updater ON updater.id = d.updated_by
      WHERE d.client_id = ?
      ORDER BY d.updated_at DESC, d.created_at DESC
    `
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
        'windows-network-discovery.ps1',
        'install-inventory-task.ps1',
        'install-performance-task.ps1'
      ];

      files.forEach(fileName => {
        let content = fs.readFileSync(path.join(agentDir, fileName), 'utf8');
        
        const endpoint = fileName.includes('network-discovery')
          ? 'network-discovery'
          : fileName.includes('inventory')
            ? 'inventory'
            : 'performance';
        
        // Substituições ultra-específicas para não quebrar a lógica interna dos scripts
        if (fileName.includes('windows-')) {
          // No script de coleta, alteramos as variáveis de configuração no topo
          content = content.replace(/\$ApiUrl\s*=\s*['"][^'"]*['"]/, `$ApiUrl = "${apiUrl}/api/agent/${endpoint}"`);
          content = content.replace(/\$API_URL\s*=\s*['"][^'"]*['"]/, `$API_URL = "${apiUrl}/api/agent/${endpoint}"`);
          content = content.replace(/\$AgentToken\s*=\s*['"][^'"]*['"]/, `$AgentToken = "${agentToken}"`);
          content = content.replace(/\$AGENT_TOKEN\s*=\s*['"][^'"]*['"]/, `$AGENT_TOKEN = "${agentToken}"`);
          content = content.replace(/\$ClientId\s*=\s*['"][^'"]*['"]/, `$ClientId = "${id}"`);
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

      const networkDiscoveryBatLines = [
        '@echo off',
        'chcp 65001 >nul',
        'echo Iniciando descoberta de rede Goldtech...',
        'echo.',
        'echo Executando varredura...',
        '',
        `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0windows-network-discovery.ps1" -ApiUrl "${apiUrl}/api/agent/network-discovery" -AgentToken "${agentToken}" -ClientId "${id}" -Cliente "${clientName}"`,
        '',
        'if %ERRORLEVEL% NEQ 0 (',
        '  echo.',
        '  echo ERRO: Falha ao executar descoberta de rede.',
        '  pause',
        '  exit /b 1',
        ')',
        '',
        'echo.',
        'echo Descoberta de rede concluida com sucesso.',
        'pause'
      ];
      const networkDiscoveryBatContent = networkDiscoveryBatLines.join('\r\n');
      zip.addFile('executar-descoberta-rede.bat', Buffer.from(networkDiscoveryBatContent, 'utf8'));

      const readmeContent = `GOLDTECH INVENTARIO - AGENTE DE COLETA

Instrucoes de instalacao:

1. Extraia todos os arquivos em uma pasta na maquina destino (ex: C:\\GoldtechAgent).
2. Clique com o botao direito em "instalar-agente.bat" e selecione "Executar como Administrador".
3. Aguarde a finalizacao dos processos.

Fluxo recomendado:
- instalar-agente.bat instala e agenda as coletas de inventario e performance.
- executar-descoberta-rede.bat roda manualmente a descoberta de ativos de rede.
- A descoberta de rede nao e agendada automaticamente nesta versao.
- Execute a descoberta em uma maquina fisica ou servidor conectado a rede do cliente.
- Por padrao, o script ignora interfaces virtuais, Hyper-V, WSL, Docker, VPN e placas desconectadas.
- Se necessario, o tecnico pode executar manualmente:
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File windows-network-discovery.ps1 -TargetSubnet "192.168.0.0/24"
- Ou limitar por interface:
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File windows-network-discovery.ps1 -InterfaceAlias "Ethernet"

Arquivos no pacote:
- windows-inventory.ps1: Script de coleta de hardware e software.
- windows-performance.ps1: Script de monitoramento de recursos (CPU/RAM/Disco).
- windows-network-discovery.ps1: Script de descoberta manual de ativos de rede.
- install-inventory-task.ps1: Configura a tarefa agendada semanal.
- install-performance-task.ps1: Configura a tarefa agendada de monitoramento continuo.
- instalar-agente.bat: Automatiza a instalacao das coletas de inventario e performance.
- executar-descoberta-rede.bat: Executa a varredura manual da rede local e envia os ativos encontrados para o Inventario.

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
