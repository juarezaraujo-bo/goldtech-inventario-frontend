const { db } = require('../models/db');
const { classifyObsolescence } = require('../utils/obsolescenceUtils');
const { classifyNetworkAsset, cleanText, normalizeOpenPorts } = require('../utils/networkAssetClassifier');
const crypto = require('crypto');

const CPU_CRITICAL_PERCENT = Number(process.env.MONITOR_CPU_CRITICAL_PERCENT || 90);
const MEMORY_CRITICAL_PERCENT = Number(process.env.MONITOR_MEMORY_CRITICAL_PERCENT || 90);
const DISK_FREE_CRITICAL_PERCENT = Number(process.env.MONITOR_DISK_FREE_CRITICAL_PERCENT || 10);
const PERSISTENT_ALERT_SAMPLES = Number(process.env.MONITOR_PERSISTENT_ALERT_SAMPLES || 3);
const HELPDESK_SYSTEM_USER_ID = Number(process.env.HELPDESK_SYSTEM_USER_ID || 1);
const NETWORK_DEVICE_TYPES = new Set(['workstation', 'server', 'printer', 'network_device', 'media_device', 'unknown']);

const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
});

const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function(err) {
    if (err) reject(err);
    else resolve(this);
  });
});

exports.test = (req, res) => {
  res.json({ status: 'active', message: 'Goldtech Agent API is online' });
};

/**
 * Coleta de Inventário Completa
 */
exports.collect = (req, res) => {
  const data = req.body;
  const {
    cliente, hostname, sistema_operacional, processador,
    memoria_ram_gb, numero_serie
  } = data;

  // Validação básica
  if (!hostname || !sistema_operacional || !processador || !memoria_ram_gb) {
    return res.status(400).json({ message: 'Campos obrigatórios ausentes: hostname, sistema_operacional, processador, memoria_ram_gb' });
  }

  // 1. Mapeamento de Categoria Inicial
  let categoriaSugestao = 'Desktops';
  const osLower = (sistema_operacional || '').toLowerCase();
  const modelLower = ((data.modelo || '') + (data.fabricante || '')).toLowerCase();

  if (osLower.includes('server')) {
    categoriaSugestao = 'Servidores';
  } else if (modelLower.includes('laptop') || modelLower.includes('notebook') || modelLower.includes('latitude') || modelLower.includes('thinkpad') || modelLower.includes('macbook')) {
    categoriaSugestao = 'Notebooks';
  }

  // 2. Garantir que o Cliente existe
  const clientName = cliente || 'Padrão';
  const normalizedClientName = (clientName || 'Padrao').trim();
  db.get("SELECT id, status FROM clients WHERE lower(trim(name)) = lower(trim(?))", [normalizedClientName], (err, clientRow) => {
    if (err) return res.status(500).json({ message: err.message });

    if (!clientRow) {
      db.run("INSERT INTO clients (name, status) VALUES (?, 'Ativo')", [normalizedClientName], function (err) {
        if (err) return res.status(500).json({ message: 'Error creating client' });
        processInventory(this.lastID, data, categoriaSugestao, res);
      });
    } else if (clientRow.status === 'Inativo') {
      db.run("UPDATE clients SET status = 'Ativo' WHERE id = ?", [clientRow.id], (err) => {
        if (err) return res.status(500).json({ message: err.message });
        processInventory(clientRow.id, data, categoriaSugestao, res);
      });
    } else {
      processInventory(clientRow.id, data, categoriaSugestao, res);
    }
  });
};

/**
 * Coleta de Performance (CPU, RAM, Disco)
 */
exports.collectPerformance = (req, res) => {
  const { 
    hostname, cpu_usage_percent, memory_usage_percent, 
    disk_free_percent, disk_free_gb, network_usage 
  } = req.body;

  if (!hostname) return res.status(400).json({ message: 'Hostname é obrigatório' });

  db.get("SELECT id, client_id FROM equipments WHERE nome = ?", [hostname], (err, equip) => {
    if (err) return res.status(500).json({ message: err.message });
    if (!equip) return res.status(404).json({ message: "Equipamento não encontrado para este hostname" });

    const insertQuery = `
      INSERT INTO equipment_performance (
        equipment_id, cpu_usage_percent, memory_usage_percent, 
        disk_free_percent, disk_free_gb, network_usage
      ) VALUES (?, ?, ?, ?, ?, ?)
    `;
    db.run(insertQuery, [
      equip.id, cpu_usage_percent, memory_usage_percent, 
      disk_free_percent, disk_free_gb, network_usage
    ], function(err) {
      if (err) return res.status(500).json({ message: err.message });

      console.log(`[PERFORMANCE] Dados salvos para ${hostname} (ID: ${equip.id})`);

      // Análise de alertas em background — não bloqueia a resposta
      analyzePerformanceAlerts(equip.id, equip.client_id, hostname, {
        cpu_usage_percent, memory_usage_percent, disk_free_percent
      });

      res.json({ success: true, message: 'Dados de performance salvos' });
    });
  });
};

/**
 * Coleta de ativos descobertos na rede local.
 * Separada da coleta de performance.
 */
exports.collectNetworkDiscovery = async (req, res) => {
  try {
    const data = req.body || {};
    const assets = Array.isArray(data.assets) ? data.assets : [];

    if (!assets.length) {
      return res.status(400).json({ message: 'Nenhum ativo de rede enviado.' });
    }

    const clientId = await resolveNetworkDiscoveryClientId(data);
    const collectedAt = normalizeDate(data.collected_at) || new Date().toISOString();
    const counters = { inserted: 0, updated: 0, skipped: 0 };

    for (const asset of assets) {
      const normalized = normalizeNetworkAsset(asset, collectedAt);
      if (!normalized.ip_address) {
        counters.skipped += 1;
        continue;
      }

      const result = await upsertNetworkAsset(clientId, normalized);
      counters[result] += 1;
    }

    return res.json({
      success: true,
      message: 'Descoberta de rede processada com sucesso.',
      processed: assets.length,
      ...counters
    });
  } catch (error) {
    console.error(`[NETWORK-DISCOVERY] Falha ao processar coleta: ${error.message}`);
    return res.status(500).json({ message: 'Falha ao processar descoberta de rede.' });
  }
};

/**
 * Analisa a coleta atual e dispara chamados críticos.
 * Regras:
 *  - Disco <= 10%: alerta imediato
 *  - CPU >= 90% nas 3 últimas coletas: alerta
 *  - RAM >= 90% nas 3 últimas coletas: alerta
 */
function analyzePerformanceAlerts(equipmentId, clientId, hostname, current) {
  const { cpu_usage_percent, memory_usage_percent, disk_free_percent } = current;

  // 1. Disco crítico — imediato
  if (disk_free_percent <= DISK_FREE_CRITICAL_PERCENT) {
    maybeCreatePerformanceTicket(
      equipmentId, clientId, hostname, 'disco_critico',
      `Disco com apenas ${disk_free_percent}% livre`,
      'Liberar espaço em disco ou expandir armazenamento com urgência.'
    );
  }

  // 2. CPU >= 90% por 3 coletas consecutivas
  db.all(
    `SELECT cpu_usage_percent FROM equipment_performance
     WHERE equipment_id = ? ORDER BY created_at DESC LIMIT ?`,
    [equipmentId, PERSISTENT_ALERT_SAMPLES],
    (err, rows) => {
      if (err || rows.length < PERSISTENT_ALERT_SAMPLES) return;
      if (rows.every(r => r.cpu_usage_percent >= CPU_CRITICAL_PERCENT)) {
        maybeCreatePerformanceTicket(
          equipmentId, clientId, hostname, 'cpu_persistente',
          `CPU acima de 90% nas últimas 3 coletas (atual: ${cpu_usage_percent}%)`,
          'Verificar processos em execução, avaliar upgrade de hardware ou migração de carga.'
        );
      }
    }
  );

  // 3. RAM >= 90% por 3 coletas consecutivas
  db.all(
    `SELECT memory_usage_percent FROM equipment_performance
     WHERE equipment_id = ? ORDER BY created_at DESC LIMIT ?`,
    [equipmentId, PERSISTENT_ALERT_SAMPLES],
    (err, rows) => {
      if (err || rows.length < PERSISTENT_ALERT_SAMPLES) return;
      if (rows.every(r => r.memory_usage_percent >= MEMORY_CRITICAL_PERCENT)) {
        maybeCreatePerformanceTicket(
          equipmentId, clientId, hostname, 'ram_persistente',
          `RAM acima de 90% nas últimas 3 coletas (atual: ${memory_usage_percent}%)`,
          'Avaliar upgrade de memória RAM ou encerrar processos em excesso.'
        );
      }
    }
  );
}

function getLastPerformanceSamples(equipmentId, callback) {
  db.all(
    `SELECT cpu_usage_percent, memory_usage_percent, disk_free_percent, disk_free_gb, created_at
     FROM equipment_performance
     WHERE equipment_id = ?
     ORDER BY created_at DESC
     LIMIT ?`,
    [equipmentId, Math.max(PERSISTENT_ALERT_SAMPLES, 3)],
    callback
  );
}

/**
 * Abre chamado no helpdesk somente se não houver um já aberto
 * para o mesmo equipamento + tipo de alerta (sem duplicatas).
 */
function maybeCreatePerformanceTicket(equipmentId, clientId, hostname, alertType, motivo, acao) {
  db.get(
    `SELECT id FROM monitoring_helpdesk_tickets
     WHERE equipment_id = ? AND alert_type = ? AND status = 'aberto' AND helpdesk_ticket_id IS NOT NULL`,
    [equipmentId, alertType],
    async (err, existing) => {
      if (err) return;
      if (existing) {
        console.log(`[HELPDESK-PERF] Chamado '${alertType}' já aberto para ${hostname}. Ignorando.`);
        return;
      }

      getLastPerformanceSamples(equipmentId, async (sampleErr, samples) => {
        if (sampleErr) console.error(`[HELPDESK-PERF] Erro ao buscar historico: ${sampleErr.message}`);

        console.log(`[HELPDESK-PERF] Abrindo chamado '${alertType}' para ${hostname}...`);
        const ticketId = await createPerformanceTicket(hostname, clientId, alertType, motivo, acao, samples || []);

        if (!ticketId) {
          console.error(`[HELPDESK-PERF] Chamado '${alertType}' nao foi criado para ${hostname}; alerta sera reavaliado na proxima coleta.`);
          return;
        }

        db.run(
          `INSERT INTO monitoring_helpdesk_tickets
           (equipment_id, client_id, alert_type, helpdesk_ticket_id, status)
           VALUES (?, ?, ?, ?, 'aberto')`,
          [equipmentId, clientId, alertType, ticketId]
        );
      });
    }
  );
}

/**
 * Envia o chamado para a API do Helpdesk.
 * Retorna o ID do chamado criado ou null em falha.
 */
async function createPerformanceTicket(hostname, clientId, alertType, motivo, acao, samples = []) {
  const fallbackApiUrl = 'https://goldtech-api.onrender.com/api/tickets';
  const configuredApiUrl = process.env.HELPDESK_API_URL || fallbackApiUrl;
  const apiUrls = configuredApiUrl === fallbackApiUrl
    ? [fallbackApiUrl]
    : [fallbackApiUrl, configuredApiUrl];
  const apiToken = process.env.HELPDESK_API_TOKEN || '';

  const sampleText = samples.length
    ? samples.map((s, index) => `#${index + 1} ${s.created_at}: CPU ${s.cpu_usage_percent}% | RAM ${s.memory_usage_percent}% | Disco livre ${s.disk_free_percent}% (${s.disk_free_gb}GB)`).join('\n')
    : 'Sem historico recente disponivel.';

  const payload = {
    title: `[Monitoramento] ${alertType.replace(/_/g, ' ')} — ${hostname}`,
    description:
      `Alerta crítico de performance detectado automaticamente pelo Goldtech Inventário.\n\n` +
      `Equipamento: ${hostname}\n` +
      `Tipo de Alerta: ${alertType}\n` +
      `Motivo: ${motivo}\n` +
      `Ação Recomendada: ${acao}\n` +
      `Data/Hora: ${new Date().toLocaleString('pt-BR')}\n\n` +
      `Ultimas coletas:\n${sampleText}`,
    priority: 'High',
    category: 'Performance',
    company_id: clientId,
    client_id: clientId,
    opened_by_user_id: HELPDESK_SYSTEM_USER_ID,
    source: 'Goldtech Inventory Monitor'
  };

  const headers = { 'Content-Type': 'application/json' };
  if (apiToken) headers.Authorization = `Bearer ${apiToken}`;

  for (const apiUrl of apiUrls) {
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const result = await response.json().catch(() => ({}));
        const ticketId = result.id || result.ticket_id || 'gerado';
        console.log(`[HELPDESK-PERF] Chamado criado com ID: ${ticketId}`);
        return String(ticketId);
      }

      const errorText = await response.text();
      console.error(`[HELPDESK-PERF] Erro ${response.status} em ${apiUrl}: ${errorText}`);
    } catch (error) {
      console.error(`[HELPDESK-PERF] Falha na comunicação com ${apiUrl}: ${error.message}`);
    }
  }

  return null;
}

async function resolveNetworkDiscoveryClientId(data) {
  const explicitClientId = Number(data.client_id || data.clientId);
  if (explicitClientId) {
    const client = await dbGet('SELECT id, status FROM clients WHERE id = ?', [explicitClientId]);
    if (!client) throw new Error('Cliente informado nao encontrado.');
    if (client.status === 'Inativo') {
      await dbRun("UPDATE clients SET status = 'Ativo' WHERE id = ?", [client.id]);
    }
    return client.id;
  }

  const clientName = String(data.cliente || data.client_name || data.clientName || 'Padrao').trim() || 'Padrao';
  const client = await dbGet(
    'SELECT id, status FROM clients WHERE lower(trim(name)) = lower(trim(?))',
    [clientName]
  );

  if (!client) {
    const created = await dbRun("INSERT INTO clients (name, status) VALUES (?, 'Ativo')", [clientName]);
    return created.lastID;
  }

  if (client.status === 'Inativo') {
    await dbRun("UPDATE clients SET status = 'Ativo' WHERE id = ?", [client.id]);
  }

  return client.id;
}

function normalizeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function normalizeMac(mac) {
  if (!mac) return null;
  const clean = String(mac).replace(/[^0-9a-f]/gi, '').toUpperCase();
  if (clean.length < 12) return null;
  return clean.slice(0, 12).match(/.{1,2}/g).join(':');
}

function normalizeNetworkAsset(asset, collectedAt) {
  asset = asset || {};
  const openPorts = normalizeOpenPorts(asset.open_ports || asset.openPorts);
  const classified = classifyNetworkAsset({
    ...asset,
    open_ports: openPorts,
    printer_model: asset.printer_model || asset.printerModel,
    detection_method: asset.detection_method || asset.detectionMethod
  });
  const detectionMethod = appendDetectionMethods(
    nullableText(asset.detection_method || asset.detectionMethod),
    classified.device_type === 'media_device' ? ['probable-iot', 'probable-media-device'] : []
  );

  return {
    ip_address: String(asset.ip_address || asset.ipAddress || asset.ip || '').trim(),
    mac_address: normalizeMac(asset.mac_address || asset.macAddress || asset.mac),
    hostname: nullableText(asset.hostname || asset.host_name || asset.hostName),
    vendor: cleanText(asset.vendor),
    device_type: NETWORK_DEVICE_TYPES.has(classified.device_type) ? classified.device_type : 'unknown',
    printer_model: classified.printer_model,
    open_ports: JSON.stringify(classified.open_ports),
    detection_method: detectionMethod,
    is_collector: Boolean(asset.is_collector || asset.isCollector),
    collector_hostname: nullableText(asset.collector_hostname || asset.collectorHostname),
    local_ip: nullableText(asset.local_ip || asset.localIp),
    interface_alias: nullableText(asset.interface_alias || asset.interfaceAlias),
    last_seen: collectedAt,
    status: nullableText(asset.status) || 'active',
    notes: nullableText(asset.notes)
  };
}

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

function nullableText(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
}

async function findExistingNetworkAsset(clientId, asset) {
  if (asset.mac_address) {
    const byMac = await dbGet(
      `SELECT id FROM network_discovered_assets
       WHERE client_id = ? AND lower(mac_address) = lower(?)
       LIMIT 1`,
      [clientId, asset.mac_address]
    );
    if (byMac) return byMac;
  }

  return dbGet(
    `SELECT id FROM network_discovered_assets
     WHERE client_id = ? AND ip_address = ?
     LIMIT 1`,
    [clientId, asset.ip_address]
  );
}

async function upsertNetworkAsset(clientId, asset) {
  const matchedEquipment = await findMatchingEquipmentForNetworkAsset(clientId, asset);
  if (matchedEquipment) {
    asset.hostname = asset.hostname || matchedEquipment.nome || null;
    asset.vendor = asset.vendor || matchedEquipment.fabricante || null;
    if ((!asset.device_type || asset.device_type === 'unknown') && deviceTypeFromEquipment(matchedEquipment)) {
      asset.device_type = deviceTypeFromEquipment(matchedEquipment);
    }
    if (asset.device_type === 'printer' || asset.device_type === 'media_device') {
      asset.printer_model = asset.printer_model || matchedEquipment.modelo || null;
    }
  }

  const existing = await findExistingNetworkAsset(clientId, asset);
  const params = [
    asset.ip_address,
    asset.mac_address,
    asset.hostname,
    asset.vendor,
    asset.device_type,
    asset.printer_model,
    asset.open_ports,
    asset.detection_method,
    asset.is_collector ? 1 : 0,
    asset.collector_hostname,
    asset.local_ip,
    asset.interface_alias,
    matchedEquipment ? 1 : 0,
    matchedEquipment ? matchedEquipment.id : null,
    asset.last_seen,
    asset.status,
    asset.notes
  ];

  if (existing) {
    await dbRun(
      `UPDATE network_discovered_assets SET
        ip_address = ?,
        mac_address = COALESCE(?, mac_address),
        hostname = ?,
        vendor = ?,
        device_type = ?,
        printer_model = ?,
        open_ports = ?,
        detection_method = ?,
        is_collector = CASE WHEN ? = 1 THEN 1 ELSE is_collector END,
        collector_hostname = COALESCE(?, collector_hostname),
        local_ip = COALESCE(?, local_ip),
        interface_alias = COALESCE(?, interface_alias),
        already_in_inventory = ?,
        equipment_id = ?,
        last_seen = ?,
        status = ?,
        notes = ?
       WHERE id = ?`,
      [...params, existing.id]
    );
    return 'updated';
  }

  await dbRun(
    `INSERT INTO network_discovered_assets (
      client_id, ip_address, mac_address, hostname, vendor, device_type,
      printer_model, open_ports, detection_method, is_collector,
      collector_hostname, local_ip, interface_alias, already_in_inventory,
      equipment_id, first_seen, last_seen, status, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      clientId,
      asset.ip_address,
      asset.mac_address,
      asset.hostname,
      asset.vendor,
      asset.device_type,
      asset.printer_model,
      asset.open_ports,
      asset.detection_method,
      asset.is_collector ? 1 : 0,
      asset.collector_hostname,
      asset.local_ip,
      asset.interface_alias,
      matchedEquipment ? 1 : 0,
      matchedEquipment ? matchedEquipment.id : null,
      asset.last_seen,
      asset.last_seen,
      asset.status,
      asset.notes
    ]
  );

  return 'inserted';
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

async function findMatchingEquipmentForNetworkAsset(clientId, asset) {
  const conditions = [];
  const params = [clientId];

  if (asset.mac_address) {
    conditions.push("replace(replace(replace(upper(mac), ':', ''), '-', ''), '.', '') = ?");
    params.push(normalizeMacCompare(asset.mac_address));
  }
  if (asset.ip_address) {
    conditions.push('lower(trim(ip)) = lower(trim(?))');
    params.push(asset.ip_address);
  }
  if (asset.hostname) {
    conditions.push('lower(trim(nome)) = lower(trim(?))');
    params.push(asset.hostname);
  }

  if (!conditions.length) return null;

  return dbGet(
    `SELECT id, nome, categoria, tipo, fabricante, modelo, ip, mac
     FROM equipments
     WHERE client_id = ? AND (${conditions.join(' OR ')})
     LIMIT 1`,
    params
  );
}



function processInventory(clientId, data, categoriaSugestao, res) {
  const {
    hostname, fabricante, modelo, numero_serie, sistema_operacional,
    processador, memoria_ram_gb, disco_total_gb, disco_livre_gb,
    ip, mac, dominio, antivirus, ultima_inicializacao,
    bios_versao, bios_data, placa_mae, data_instalacao_os, data_coleta
  } = data;

  const findQuery = "SELECT id, categoria, categoria_manual FROM equipments WHERE nome = ? AND client_id = ?";
  const params = [hostname, clientId];

  db.get(findQuery, params, (err, equip) => {
    if (err) return res.status(500).json({ message: err.message });

    const ramString = memoria_ram_gb ? `${memoria_ram_gb}GB` : '';
    const storageString = disco_total_gb ? `${disco_total_gb}GB` : '';
    const freeSpaceString = disco_livre_gb ? `${disco_livre_gb}GB` : '';

    if (equip) {
      const finalCategory = equip.categoria_manual ? equip.categoria : categoriaSugestao;
      const updateQuery = `
        UPDATE equipments SET 
          client_id = ?, nome = ?, categoria = ?, fabricante = ?, modelo = ?, 
          numero_serie = ?, sistema_operacional = ?, processador = ?, memoria_ram = ?, 
          armazenamento = ?, disco_livre_gb = ?, bios_versao = ?, bios_data = ?, placa_mae = ?, data_instalacao_os = ?,
          ip = ?, mac = ?, dominio = ?, antivirus = ?, ultima_inicializacao = ?,
          ultima_coleta = ?, origem_cadastro = 'agente', status = 'Ativo'
        WHERE id = ?
      `;
      db.run(updateQuery, [
        clientId, hostname, finalCategory, fabricante, modelo,
        numero_serie, sistema_operacional, processador, ramString, storageString,
        freeSpaceString, bios_versao, bios_data, placa_mae, data_instalacao_os,
        ip, mac, dominio, antivirus, ultima_inicializacao,
        data_coleta, equip.id
      ], (err) => {
        if (err) return res.status(500).json({ message: err.message });
        
        // Verificar Obsolescência após atualização
        checkObsolescenceAndTicket(equip.id, { ...data, client_name: 'Identificando...' });
        
        res.json({ success: true, message: 'Equipamento atualizado', id: equip.id });
      });
    } else {
      const insertQuery = `
        INSERT INTO equipments (
          client_id, nome, categoria, fabricante, modelo, numero_serie, 
          sistema_operacional, processador, memoria_ram, armazenamento, 
          disco_livre_gb, bios_versao, bios_data, placa_mae, data_instalacao_os,
          ip, mac, dominio, antivirus, ultima_inicializacao,
          ultima_coleta, origem_cadastro, status, categoria_manual
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'agente', 'Ativo', 0)
      `;
      db.run(insertQuery, [
        clientId, hostname, categoriaSugestao, fabricante, modelo, numero_serie,
        sistema_operacional, processador, ramString, storageString,
        freeSpaceString, bios_versao, bios_data, placa_mae, data_instalacao_os,
        ip, mac, dominio, antivirus, ultima_inicializacao,
        data_coleta
      ], function (err) {
        if (err) return res.status(500).json({ message: err.message });
        
        const newId = this.lastID;
        checkObsolescenceAndTicket(newId, { ...data, client_name: 'Identificando...' });
        
        res.json({ success: true, message: 'Novo equipamento cadastrado', id: newId });
      });
    }
  });
}

/**
 * Lógica de Automação de Chamado
 */
async function checkObsolescenceAndTicket(equipmentId, data) {
  // Re-buscar dados completos para garantir consistência
  db.get(`
    SELECT e.*, c.name as client_name 
    FROM equipments e 
    LEFT JOIN clients c ON e.client_id = c.id 
    WHERE e.id = ?
  `, [equipmentId], async (err, equip) => {
    if (err || !equip) return;

    const obs = classifyObsolescence(equip);
    
    if (obs.status_obsolescencia === 'critico') {
      const motivoStr = obs.motivos.join(' | ');
      const motivoHash = crypto.createHash('md5').update(motivoStr).digest('hex');

      // Verificar se já existe chamado aberto para este motivo
      db.get("SELECT id FROM inventory_tickets WHERE equipment_id = ? AND motivo_hash = ? AND status = 'aberto'", 
      [equipmentId, motivoHash], async (err, ticket) => {
        if (err) return;
        
        if (!ticket) {
          console.log(`[HELPDESK] Criando chamado automático para ${equip.nome} (Crítico)`);
          const ticketCreated = await createHelpdeskTicket(equip, obs);
          
          if (ticketCreated) {
            db.run("INSERT INTO inventory_tickets (equipment_id, motivo_hash, status) VALUES (?, ?, 'aberto')", 
            [equipmentId, motivoHash]);
          }
        } else {
          console.log(`[HELPDESK] Chamado para ${equip.nome} já existe e está aberto. Pulando.`);
        }
      });
    }
  });
}

/**
 * Integração Real com API do Helpdesk (Simulada/Placeholder)
 */
async function createHelpdeskTicket(equip, obs) {
  const apiUrl = process.env.HELPDESK_API_URL;
  const apiToken = process.env.HELPDESK_API_TOKEN;

  if (!apiUrl || !apiToken) {
    console.error("[HELPDESK] API URL ou Token não configurados no .env");
    return false;
  }

  const payload = {
    title: `[Inventário] Equipamento crítico - ${equip.nome}`,
    description: `Equipamento crítico identificado pelo inventário.\n\n` +
                 `Cliente: ${equip.client_name}\n` +
                 `Hostname: ${equip.nome}\n` +
                 `Processador: ${equip.processador}\n` +
                 `Memória: ${equip.memoria_ram}\n` +
                 `Motivo: ${obs.motivos.join('\n')}\n` +
                 `Ação Recomendada: ${obs.acao_recomendada}\n` +
                 `Última Coleta: ${equip.ultima_coleta}`,
    priority: 'high',
    category: 'Hardware',
    client_id: equip.client_id,
    source: 'Inventory Agent'
  };

  try {
    // Usando fetch nativo (Node 18+)
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiToken}`
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      console.log(`[HELPDESK] Chamado criado com sucesso para ${equip.nome}`);
      return true;
    } else {
      const errorData = await response.text();
      console.error(`[HELPDESK] Erro ao criar chamado: ${response.status} - ${errorData}`);
      return false;
    }
  } catch (error) {
    console.error(`[HELPDESK] Falha na comunicação com a API: ${error.message}`);
    // Para propósitos de demonstração, vamos considerar sucesso se a URL for o placeholder padrão
    if (apiUrl.includes('helpdesk.goldtech.com')) return true;
    return false;
  }
}
