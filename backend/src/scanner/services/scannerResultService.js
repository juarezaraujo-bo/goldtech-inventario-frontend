const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const puppeteer = require('puppeteer');

const MAX_SUMMARY_FINDINGS = 20;
const ATTENTION_PORTS = new Set([21, 22, 23, 25, 53, 80, 135, 139, 445, 1433, 3306, 3389, 5432, 5900, 5985, 5986, 8080]);
const SENSITIVE_PROCESS_TERMS = [
  'powershell',
  'cmd',
  'wscript',
  'cscript',
  'mshta',
  'rundll32',
  'regsvr32',
  'psexec',
  'nmap',
  'netcat',
  'nc',
  'mimikatz',
  'anydesk',
  'teamviewer',
  'rustdesk',
  'openvpn',
  'wireguard'
];

function getProjectRoot() {
  return path.resolve(__dirname, '../../../');
}

function getResultsStorageRoot() {
  return process.env.SCANNER_RESULTS_STORAGE_PATH
    ? path.resolve(process.env.SCANNER_RESULTS_STORAGE_PATH)
    : path.join(getProjectRoot(), 'storage', 'scanner-results');
}

function ensureClientResultsDir(clientId) {
  const clientDir = path.join(getResultsStorageRoot(), String(clientId));
  fs.mkdirSync(clientDir, { recursive: true });
  return clientDir;
}

function calculateBufferSha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function hasUtf8Bom(buffer) {
  return buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF;
}

function hasUtf16LeBom(buffer) {
  return buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE;
}

function hasUtf16BeBom(buffer) {
  return buffer.length >= 2 && buffer[0] === 0xFE && buffer[1] === 0xFF;
}

function looksLikeUtf16Le(buffer) {
  const sampleLength = Math.min(buffer.length, 200);
  if (sampleLength < 4) return false;

  let oddNulls = 0;
  let evenNulls = 0;
  for (let index = 0; index < sampleLength; index += 1) {
    if (buffer[index] !== 0x00) continue;
    if (index % 2 === 0) evenNulls += 1;
    else oddNulls += 1;
  }

  return oddNulls > evenNulls && oddNulls >= Math.floor(sampleLength / 8);
}

function looksLikeUtf16Be(buffer) {
  const sampleLength = Math.min(buffer.length, 200);
  if (sampleLength < 4) return false;

  let oddNulls = 0;
  let evenNulls = 0;
  for (let index = 0; index < sampleLength; index += 1) {
    if (buffer[index] !== 0x00) continue;
    if (index % 2 === 0) evenNulls += 1;
    else oddNulls += 1;
  }

  return evenNulls > oddNulls && evenNulls >= Math.floor(sampleLength / 8);
}

function decodeUtf16Be(buffer) {
  const swapped = Buffer.alloc(buffer.length);
  for (let index = 0; index < buffer.length; index += 2) {
    swapped[index] = buffer[index + 1] || 0x00;
    swapped[index + 1] = buffer[index];
  }
  return swapped.toString('utf16le');
}

function cleanJsonContent(content) {
  return String(content || '')
    .replace(/^\uFEFF/, '')
    .replace(/\u0000/g, '')
    .trim();
}

function detectJsonEncoding(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error('Conteudo enviado nao e um buffer valido.');
  }

  if (hasUtf8Bom(buffer)) return 'utf8-bom';
  if (hasUtf16LeBom(buffer)) return 'utf16le-bom';
  if (hasUtf16BeBom(buffer)) return 'utf16be-bom';
  if (looksLikeUtf16Le(buffer)) return 'utf16le';
  if (looksLikeUtf16Be(buffer)) return 'utf16be';
  return 'utf8';
}

function decodeJsonBuffer(buffer) {
  const encoding = detectJsonEncoding(buffer);

  if (hasUtf8Bom(buffer)) {
    return cleanJsonContent(buffer.slice(3).toString('utf8'));
  }

  if (hasUtf16LeBom(buffer)) {
    return cleanJsonContent(buffer.slice(2).toString('utf16le'));
  }

  if (hasUtf16BeBom(buffer)) {
    return cleanJsonContent(decodeUtf16Be(buffer.slice(2)));
  }

  if (encoding === 'utf16le') {
    return cleanJsonContent(buffer.toString('utf16le'));
  }

  if (encoding === 'utf16be') {
    return cleanJsonContent(decodeUtf16Be(buffer));
  }

  return cleanJsonContent(buffer.toString('utf8'));
}

function parseJsonBuffer(buffer) {
  return JSON.parse(decodeJsonBuffer(buffer));
}

function readJsonFileFlexible(filePath) {
  return parseJsonBuffer(fs.readFileSync(filePath));
}

function getJsonContentPreview(buffer, maxLength = 120) {
  try {
    return decodeJsonBuffer(buffer).slice(0, maxLength);
  } catch {
    return '';
  }
}

function getFirstBytesHex(buffer, byteCount = 8) {
  if (!Buffer.isBuffer(buffer)) return '';
  return Array.from(buffer.slice(0, byteCount))
    .map((byte) => byte.toString(16).padStart(2, '0').toUpperCase())
    .join(' ');
}

function sanitizeFilename(filename) {
  const parsed = path.parse(filename || 'resultado-diagnostico.json');
  const safeName = parsed.name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '') || 'resultado-diagnostico';

  return `${safeName}.json`;
}

function buildStoredFilename(originalFilename, sha256) {
  const timestamp = Date.now();
  const parsed = path.parse(sanitizeFilename(originalFilename));
  return `${parsed.name}_${timestamp}_${sha256.slice(0, 12)}.json`;
}

function getValue(source, key) {
  if (!key.includes('.')) {
    return source?.[key];
  }

  return key.split('.').reduce((value, pathPart) => value?.[pathPart], source);
}

function pickString(source, keys) {
  for (const key of keys) {
    const value = getValue(source, key);
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function pickInteger(source, keys) {
  for (const key of keys) {
    const value = getValue(source, key);
    if (typeof value === 'number' && Number.isInteger(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim() && Number.isInteger(Number(value))) {
      return Number(value);
    }
  }
  return null;
}

function getArrayLength(value) {
  return Array.isArray(value) ? value.length : null;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function firstNumber(...values) {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}

function pickNumber(source, keys) {
  for (const key of keys) {
    const value = getValue(source, key);
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return null;
}

function normalizeProcessName(value) {
  return String(value || '')
    .trim()
    .replace(/^.*[\\/]/, '')
    .replace(/\.(exe|bat|cmd|ps1|psm1|vbs|js)$/i, '')
    .toLowerCase();
}

function isSensitiveProcessName(processName) {
  const normalized = normalizeProcessName(processName);
  if (!normalized) return false;

  return SENSITIVE_PROCESS_TERMS.some((term) => {
    if (term === 'nc') {
      return normalized === 'nc' || normalized === 'nc.exe';
    }
    return normalized.includes(term);
  });
}

function pickProcessPath(item) {
  const value = pickString(item, ['Path', 'path']);
  if (!value) return null;

  const normalized = value.toLowerCase();
  if (normalized === 'processes' || normalized === 'connections') {
    return null;
  }

  return value;
}

function getPortValue(item) {
  return pickNumber(item, ['Port', 'port', 'LocalPort', 'localPort']);
}

function isPrivateOrLocalRemoteAddress(address) {
  const value = String(address || '').trim();
  if (!value || value === '0.0.0.0' || value === '::' || value === '::1' || value === '127.0.0.1') {
    return true;
  }

  if (value.startsWith('127.')) return true;
  if (value.includes(':')) return false;

  const parts = value.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const [first, second] = parts;
  if (first === 10) return true;
  if (first === 172 && second >= 16 && second <= 31) return true;
  if (first === 192 && second === 168) return true;
  if (first === 169 && second === 254) return true;

  return false;
}

function buildAttentionPorts(listeningPorts) {
  const unique = new Map();

  asArray(listeningPorts).forEach((item) => {
    const port = getPortValue(item);
    if (!port || !ATTENTION_PORTS.has(port)) return;

    const processName = pickString(item, ['Process', 'process', 'Name', 'name']);
    const key = `${port}:${processName || ''}`;
    if (!unique.has(key)) {
      unique.set(key, {
        port,
        process: processName,
        protocol: pickString(item, ['Protocol', 'protocol']),
        localAddress: pickString(item, ['LocalAddress', 'localAddress', 'local_address'])
      });
    }
  });

  return Array.from(unique.values()).slice(0, 20);
}

function buildSensitiveProcesses(processes, connections) {
  const unique = new Map();

  asArray(processes).forEach((processItem) => {
    const name = pickString(processItem, ['Name', 'name', 'ProcessName', 'processName', 'Process', 'process']);
    if (!isSensitiveProcessName(name)) return;

    const key = normalizeProcessName(name);
    if (!unique.has(key)) {
      unique.set(key, {
        name,
        pid: pickNumber(processItem, ['PID', 'Pid', 'pid', 'Id', 'id']),
        path: pickProcessPath(processItem),
        source: 'processes',
        reason: 'Processo administrativo ou sensivel que requer validacao tecnica.'
      });
    }
  });

  asArray(connections).forEach((connection) => {
    const name = pickString(connection, ['Process', 'process', 'ProcessName', 'processName', 'OwningProcessName']);
    if (!isSensitiveProcessName(name)) return;

    const key = normalizeProcessName(name);
    if (!unique.has(key)) {
      unique.set(key, {
        name,
        pid: pickNumber(connection, ['PID', 'Pid', 'pid', 'OwningProcess', 'owningProcess']),
        path: pickProcessPath(connection),
        source: 'connections',
        reason: 'Processo administrativo ou sensivel observado em conexao de rede.'
      });
    }
  });

  return Array.from(unique.values()).slice(0, 20);
}

function buildExternalConnections(connections) {
  return asArray(connections)
    .filter((connection) => {
      const remoteAddress = pickString(connection, ['RemoteAddress', 'remoteAddress', 'remote_address']);
      return !isPrivateOrLocalRemoteAddress(remoteAddress);
    })
    .slice(0, 30)
    .map((connection) => ({
      remoteAddress: pickString(connection, ['RemoteAddress', 'remoteAddress', 'remote_address']),
      remotePort: pickNumber(connection, ['RemotePort', 'remotePort', 'remote_port']),
      localAddress: pickString(connection, ['LocalAddress', 'localAddress', 'local_address']),
      localPort: pickNumber(connection, ['LocalPort', 'localPort', 'local_port']),
      state: pickString(connection, ['State', 'state']),
      process: pickString(connection, ['Process', 'process', 'ProcessName', 'processName', 'OwningProcessName'])
    }));
}

function getRawConnections(data) {
  return asArray(data.connections);
}

function getRawProcesses(data) {
  return asArray(data.processes);
}

function getRawListeningPorts(data) {
  return Array.isArray(data.listening_ports) ? data.listening_ports : asArray(data.listeningPorts);
}

function hasRawCollectionData(data) {
  return Array.isArray(data.connections) || Array.isArray(data.processes) ||
    Array.isArray(data.listening_ports) || Array.isArray(data.listeningPorts);
}

function countFindingsByRule(findings, ruleIds) {
  const allowedRules = new Set(ruleIds);
  return asArray(findings).filter((finding) => allowedRules.has(pickString(finding, ['rule_id', 'ruleId', 'id']))).length;
}

function buildAttentionPortsFromFindings(findings) {
  const unique = new Map();

  asArray(findings).forEach((finding) => {
    const evidence = finding?.evidence || {};
    const port = getPortValue(evidence);
    if (!port || !ATTENTION_PORTS.has(port)) return;

    const key = `${port}:${pickString(evidence, ['Process', 'process', 'Name', 'name']) || ''}`;
    if (!unique.has(key)) {
      unique.set(key, {
        port,
        process: pickString(evidence, ['Process', 'process', 'Name', 'name']),
        protocol: pickString(evidence, ['Protocol', 'protocol']),
        localAddress: pickString(evidence, ['LocalAddress', 'localAddress', 'local_address']),
        source: 'findings',
        reason: pickString(finding, ['description', 'summary', 'title'])
      });
    }
  });

  return Array.from(unique.values()).slice(0, 20);
}

function buildSummaryCounts(data, derived) {
  const findings = asArray(data.findings);
  const summary = data.summary || {};
  const counts = data.counts || {};
  const sensitiveProcessFindingsCount = countFindingsByRule(findings, ['RULE-003']);

  const connectionsCount = firstNumber(
    getArrayLength(data.connections),
    summary.connectionsCount,
    summary.connections_count,
    counts.connections,
    0
  );

  const processesCount = firstNumber(
    getArrayLength(data.processes),
    summary.processesCount,
    summary.processes_count,
    counts.processes,
    0
  );

  const listeningPortsCount = firstNumber(
    getArrayLength(data.listening_ports),
    getArrayLength(data.listeningPorts),
    summary.listeningPortsCount,
    summary.listening_ports_count,
    counts.listening_ports,
    counts.listeningPorts,
    0
  );

  return {
    connectionsCount,
    processesCount,
    listeningPortsCount,
    externalConnectionsCount: firstNumber(
      derived.externalConnections.length,
      summary.externalConnectionsCount,
      summary.external_connections_count,
      counts.external_connections,
      counts.externalConnections,
      0
    ),
    sensitiveProcessesCount: firstNumber(
      derived.sensitiveProcesses.length,
      summary.sensitiveProcessesCount,
      summary.sensitive_processes_count,
      counts.sensitive_processes,
      counts.sensitiveProcesses,
      sensitiveProcessFindingsCount,
      0
    ),
    attentionPortsCount: firstNumber(
      summary.attentionPortsCount,
      summary.attention_ports_count,
      counts.attention_ports,
      counts.attentionPorts,
      derived.attentionPorts.length,
      0
    ),
    findingsCount: firstNumber(
      getArrayLength(data.findings),
      data.total_findings,
      data.totalFindings,
      summary.totalFindings,
      summary.total_findings,
      counts.findings,
      0
    )
  };
}

function buildExecutiveSummary({ attentionPorts, sensitiveProcesses, externalConnections }) {
  const summary = [];

  if (attentionPorts.length > 0) {
    summary.push('Foram identificadas portas em escuta que devem ser validadas tecnicamente.');
  }
  if (sensitiveProcesses.length > 0) {
    summary.push('Foram encontrados processos administrativos ou sensíveis em execução.');
  }
  if (externalConnections.length > 0) {
    summary.push('Há conexões externas ativas que devem ser revisadas conforme o perfil de uso da máquina.');
  }
  if (summary.length === 0) {
    summary.push('Não foram destacados pontos de atenção básicos a partir das regras simples desta análise.');
  }

  summary.push('Este diagnóstico indica pontos de atenção, mas não confirma infecção, invasão ou malware.');
  return summary;
}

function analyzeScannerResult(resultRecord) {
  const data = readJsonFileFlexible(resultRecord.file_path);
  const metadata = extractMetadata(data);
  const connections = getRawConnections(data);
  const processes = getRawProcesses(data);
  const listeningPorts = getRawListeningPorts(data);
  const rawCollection = hasRawCollectionData(data);
  const analysisSource = rawCollection ? 'raw-collection' : 'diagnostic-summary';
  const attentionPorts = rawCollection ? buildAttentionPorts(listeningPorts) : buildAttentionPortsFromFindings(data.findings);
  const sensitiveProcesses = buildSensitiveProcesses(processes, connections);
  const externalConnections = buildExternalConnections(connections);
  const riskLevel = metadata.risk_level || resultRecord.risk_level || null;
  const riskScore = metadata.risk_score ?? resultRecord.risk_score ?? null;
  const summaryCounts = buildSummaryCounts(data, { attentionPorts, sensitiveProcesses, externalConnections });

  return {
    resultId: resultRecord.id,
    clientId: resultRecord.client_id,
    analysisSource,
    hostName: metadata.host_name || resultRecord.host_name || null,
    scannerVersion: metadata.scanner_version || resultRecord.scanner_version || null,
    collectedAt: metadata.collected_at || resultRecord.collected_at || null,
    riskLevel,
    risk_level: riskLevel,
    riskScore,
    risk_score: riskScore,
    summary: summaryCounts,
    attentionPorts,
    sensitiveProcesses,
    externalConnections,
    executiveSummary: buildExecutiveSummary({ attentionPorts, sensitiveProcesses, externalConnections }),
    technicalNotes: [
      'Este diagnóstico não é antivírus.',
      'Os achados devem ser validados por um técnico antes de qualquer ação.',
      'A presença de uma porta, processo ou conexão não significa, isoladamente, comprometimento.'
    ]
  };
}

function extractSeverityCounts(findings) {
  if (!Array.isArray(findings)) return {};

  return findings.reduce((acc, finding) => {
    const severity = typeof finding?.severity === 'string' && finding.severity.trim()
      ? finding.severity.trim().toLowerCase()
      : 'unknown';
    acc[severity] = (acc[severity] || 0) + 1;
    return acc;
  }, {});
}

function summarizeFindings(findings) {
  if (!Array.isArray(findings)) return [];

  return findings.slice(0, MAX_SUMMARY_FINDINGS).map((finding) => ({
    rule_id: pickString(finding, ['rule_id', 'ruleId', 'id']),
    severity: pickString(finding, ['severity', 'risk_level', 'riskLevel']),
    description: pickString(finding, ['description', 'summary', 'title'])
  }));
}

function extractMetadata(json) {
  const scannerVersion = pickString(json, ['scanner_version', 'scannerVersion', 'metadata.scannerVersion', 'version']);
  const mode = pickString(json, ['mode', 'metadata.mode', 'scan_mode', 'scanMode']);
  const hostName = pickString(json, [
    'hostname',
    'hostName',
    'host_name',
    'computerName',
    'metadata.hostName',
    'computer_name'
  ]);
  const collectedAt = pickString(json, [
    'collection_timestamp',
    'collectedAt',
    'collected_at',
    'generatedAt',
    'metadata.collectedAt',
    'analysis_timestamp',
    'analysisTimestamp',
    'timestamp',
    'generated_at'
  ]);
  const riskLevel = pickString(json, ['riskLevel', 'risk_level', 'risk', 'summary.riskLevel', 'summary.risk_level']);
  const riskScore = pickNumber(json, ['riskScore', 'risk_score', 'score', 'summary.riskScore', 'summary.risk_score']);

  return {
    scanner_version: scannerVersion,
    mode,
    host_name: hostName,
    collected_at: collectedAt,
    risk_level: riskLevel,
    risk_score: riskScore
  };
}

function buildSummary(json) {
  const findings = Array.isArray(json.findings) ? json.findings : [];

  return {
    client_id: json.client_id ?? null,
    client_name: pickString(json, ['client_name', 'clientName']),
    username: pickString(json, ['username', 'userName', 'metadata.username']),
    scanner_version: pickString(json, ['scanner_version', 'scannerVersion', 'metadata.scannerVersion', 'version']),
    mode: pickString(json, ['mode', 'metadata.mode', 'scan_mode', 'scanMode']),
    host_name: pickString(json, ['hostname', 'hostName', 'host_name', 'computerName', 'metadata.hostName', 'computer_name']),
    collected_at: pickString(json, [
      'collection_timestamp',
      'collectedAt',
      'collected_at',
      'generatedAt',
      'metadata.collectedAt',
      'analysis_timestamp',
      'analysisTimestamp',
      'timestamp',
      'generated_at'
    ]),
    risk_level: pickString(json, ['risk_level', 'riskLevel', 'risk', 'summary.riskLevel', 'summary.risk_level']),
    risk_score: pickNumber(json, ['risk_score', 'riskScore', 'score', 'summary.riskScore', 'summary.risk_score']),
    connections_count: getArrayLength(json.connections) || 0,
    processes_count: getArrayLength(json.processes) || 0,
    listening_ports_count: getArrayLength(json.listening_ports) || 0,
    total_findings: pickInteger(json, ['total_findings', 'totalFindings']) ?? getArrayLength(findings),
    severity_counts: extractSeverityCounts(findings),
    counts: {
      processes: getArrayLength(json.processes),
      listening_ports: getArrayLength(json.listening_ports),
      connections: getArrayLength(json.connections),
      findings: getArrayLength(findings)
    },
    findings_preview: summarizeFindings(findings),
    summary_generated_at: new Date().toISOString()
  };
}

function saveResultFile(clientId, originalFilename, buffer, sha256) {
  const clientDir = ensureClientResultsDir(clientId);
  const filename = buildStoredFilename(originalFilename, sha256);
  const filePath = path.join(clientDir, filename);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

function deleteResultFile(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatReportValue(value, fallback = '-') {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value);
}

function formatReportDate(value) {
  if (!value) return '-';
  const date = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('pt-BR');
}

function renderRows(items, columns, emptyMessage) {
  const rows = Array.isArray(items) ? items : [];
  if (rows.length === 0) {
    return `<tr><td colspan="${columns.length}" class="empty">${escapeHtml(emptyMessage)}</td></tr>`;
  }

  return rows.map((item) => (
    '<tr>' +
    columns.map((column) => `<td>${escapeHtml(formatReportValue(column.value(item)))}</td>`).join('') +
    '</tr>'
  )).join('');
}

function buildReportFilename(client, analysis) {
  const clientPart = sanitizeFilename(client?.name || 'cliente').replace(/\.json$/i, '');
  const hostPart = sanitizeFilename(analysis.hostName || 'host').replace(/\.json$/i, '');
  const datePart = new Date().toISOString().slice(0, 10);
  return `relatorio-diagnostico-${clientPart}-${hostPart}-${datePart}.html`;
}

function buildReportPdfFilename(client, analysis) {
  const clientPart = sanitizeFilename(client?.name || 'cliente').replace(/\.json$/i, '');
  const hostPart = sanitizeFilename(analysis.hostName || 'host').replace(/\.json$/i, '');
  const datePart = new Date().toISOString().slice(0, 10);
  return `diagnostico-seguranca-${clientPart}-${hostPart}-${datePart}.pdf`;
}

function formatAttentionLevel(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return 'Não classificado';

  if (['low', 'baixo'].includes(normalized)) return 'Baixo';
  if (['medium', 'medio', 'médio', 'moderate'].includes(normalized)) return 'Médio';
  if (['high', 'alto', 'critical', 'critico', 'crítico'].includes(normalized)) return 'Alto';

  return formatReportValue(value, 'Não classificado');
}

function renderList(items, emptyMessage) {
  const rows = Array.isArray(items) ? items.filter(Boolean) : [];
  if (rows.length === 0) {
    return `<p class="muted">${escapeHtml(emptyMessage)}</p>`;
  }

  return `<ul>${rows.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

function renderPointCard(title, count, description) {
  return `
        <article class="point-card">
          <div class="point-count">${escapeHtml(formatReportValue(count, '0'))}</div>
          <div>
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(description)}</p>
          </div>
        </article>`;
}

function renderSecurityDiagnosticReportHtml({ client, analysis }) {
  const summary = analysis.summary || {};
  const attentionLevel = formatAttentionLevel(analysis.riskLevel || analysis.risk_level);
  const riskScore = formatReportValue(analysis.riskScore ?? analysis.risk_score);
  const generatedAt = formatReportDate(new Date().toISOString());
  const collectedAt = formatReportDate(analysis.collectedAt);
  const clientName = formatReportValue(client?.name);
  const hostName = formatReportValue(analysis.hostName);
  const scannerVersion = formatReportValue(analysis.scannerVersion);

  const indicators = [
    ['Conexões analisadas', summary.connectionsCount],
    ['Processos analisados', summary.processesCount],
    ['Portas em escuta', summary.listeningPortsCount],
    ['Conexões externas observadas', summary.externalConnectionsCount],
    ['Processos sensíveis/administrativos', summary.sensitiveProcessesCount],
    ['Portas que exigem validação', summary.attentionPortsCount]
  ];

  const executiveSummary = [
    'Foi realizado um diagnóstico técnico no equipamento analisado com foco em conexões de rede, portas em escuta e processos relevantes.',
    'Os itens identificados neste relatório representam pontos que devem ser revisados para confirmar se estão alinhados ao perfil esperado de uso do ambiente.'
  ];

  const technicalNotes = Array.isArray(analysis.technicalNotes) ? analysis.technicalNotes : [];
  const recommendations = [
    'Confirmar se ferramentas administrativas foram utilizadas por equipe autorizada.',
    'Validar se as portas identificadas são necessárias para a operação.',
    'Revisar conexões externas fora do padrão esperado.',
    'Repetir o diagnóstico após ajustes.',
    'Avaliar políticas de firewall, controle de acesso e monitoramento contínuo.'
  ];
  const nextSteps = [
    'Validação técnica dos achados.',
    'Classificação do que é esperado ou não no ambiente.',
    'Ajustes de firewall, permissões ou serviços, se necessário.',
    'Nova coleta para comparação.',
    'Definição de monitoramento recorrente.'
  ];

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Diagnóstico Executivo de Segurança</title>
  <style>
    :root {
      --gold: #b8902e;
      --gold-soft: #fff4cf;
      --green: #047857;
      --green-dark: #064e3b;
      --ink: #111827;
      --muted: #64748b;
      --line: #e5e7eb;
      --bg: #f6f8fb;
      --panel: #ffffff;
    }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: var(--ink); background: var(--bg); line-height: 1.55; }
    .page { max-width: 1120px; margin: 0 auto; padding: 28px 22px 46px; }
    .cover { position: relative; overflow: hidden; color: #fff; background: linear-gradient(135deg, #07111f 0%, #0b2f29 68%, #0f5132 100%); border-radius: 22px; padding: 34px; border-bottom: 6px solid var(--gold); box-shadow: 0 20px 45px rgba(15, 23, 42, .16); }
    .cover:after { content: ""; position: absolute; right: -90px; top: -120px; width: 280px; height: 280px; border-radius: 50%; background: rgba(184, 144, 46, .22); }
    .brand { color: #f9dd82; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; font-size: 12px; }
    h1 { margin: 10px 0 8px; font-size: 34px; line-height: 1.1; max-width: 720px; }
    .subtitle { max-width: 760px; color: #dbeafe; margin: 0; font-size: 15px; }
    h2 { margin: 0 0 14px; font-size: 20px; color: #0f172a; }
    h3 { margin: 0 0 5px; font-size: 15px; color: #0f172a; }
    section { margin-top: 22px; }
    .meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; margin-top: 26px; position: relative; z-index: 1; }
    .meta div, .card, .metric, .point-card { background: var(--panel); border: 1px solid var(--line); border-radius: 16px; padding: 17px; }
    .meta div { background: rgba(255,255,255,.08); border-color: rgba(255,255,255,.18); }
    .meta label, .metric label, .level-label { display: block; color: var(--muted); font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .07em; margin-bottom: 6px; }
    .cover .meta label { color: #cbd5e1; }
    .meta strong, .metric strong { font-size: 15px; overflow-wrap: anywhere; }
    .cover .meta strong { color: #fff; }
    .notice { border-left: 5px solid var(--gold); background: var(--gold-soft); color: #3f2f08; }
    .executive-grid { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(240px, .8fr); gap: 16px; }
    .level { display: flex; align-items: center; justify-content: space-between; gap: 18px; background: #ecfdf5; border-color: #bbf7d0; }
    .level strong { display: block; font-size: 30px; color: var(--green-dark); }
    .score { color: var(--muted); font-weight: 700; }
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(165px, 1fr)); gap: 12px; }
    .metric strong { display: block; font-size: 28px; color: var(--green); }
    .points { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 12px; }
    .point-card { display: flex; gap: 14px; align-items: flex-start; }
    .point-count { min-width: 46px; height: 46px; border-radius: 14px; display: grid; place-items: center; background: #ecfdf5; color: var(--green-dark); font-size: 21px; font-weight: 900; }
    .point-card p, .muted { color: var(--muted); margin: 0; }
    .section-kicker { color: var(--green); font-weight: 800; text-transform: uppercase; letter-spacing: .08em; font-size: 11px; margin-bottom: 6px; }
    ul { margin: 0; padding-left: 20px; }
    li { margin: 6px 0; }
    table { width: 100%; border-collapse: separate; border-spacing: 0; background: var(--panel); border: 1px solid var(--line); border-radius: 16px; overflow: hidden; }
    th { text-align: left; background: #0f172a; color: #fff; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; padding: 12px; }
    td { border-top: 1px solid var(--line); padding: 12px; font-size: 13px; vertical-align: top; }
    tr:nth-child(even) td { background: #f9fafb; }
    .empty { color: var(--muted); text-align: center; padding: 24px; }
    footer { margin-top: 28px; color: var(--muted); font-size: 12px; text-align: center; }
    @media (max-width: 780px) { .executive-grid { grid-template-columns: 1fr; } h1 { font-size: 28px; } .cover { padding: 26px; } }
    @media print { body { background: #fff; } .page { max-width: none; padding: 0; } .cover, .card, .metric, .point-card, table { break-inside: avoid; box-shadow: none; } }
  </style>
</head>
<body>
  <main class="page">
    <header class="cover">
      <div class="brand">Goldtech Soluções em Tecnologia</div>
      <h1>Diagnóstico Executivo de Segurança</h1>
      <p class="subtitle">Relatório de apoio à decisão com pontos de atenção observados no ambiente analisado.</p>
      <div class="meta">
        <div><label>Cliente</label><strong>${escapeHtml(clientName)}</strong></div>
        <div><label>Host analisado</label><strong>${escapeHtml(hostName)}</strong></div>
        <div><label>Data da coleta</label><strong>${escapeHtml(collectedAt)}</strong></div>
        <div><label>Data de geração</label><strong>${escapeHtml(generatedAt)}</strong></div>
        <div><label>Versão do scanner</label><strong>${escapeHtml(scannerVersion)}</strong></div>
      </div>
    </header>

    <section class="card notice">
      <h2>Aviso técnico</h2>
      <p>Este relatório não confirma infecção, invasão ou presença de malware. O objetivo é apresentar pontos de atenção identificados no ambiente analisado, apoiando a validação técnica e a tomada de decisão.</p>
    </section>

    <section class="executive-grid">
      <div class="card">
        <div class="section-kicker">Visão executiva</div>
        <h2>Resumo executivo</h2>
        ${renderList(executiveSummary, 'Resumo executivo não disponível.')}
      </div>
      <div class="card level">
        <div>
          <span class="level-label">Nível geral de atenção</span>
          <strong>${escapeHtml(attentionLevel)}</strong>
          <div class="score">Score: ${escapeHtml(riskScore)}</div>
        </div>
      </div>
    </section>

    <section>
      <div class="section-kicker">Indicadores principais</div>
      <h2>Indicadores do diagnóstico</h2>
      <div class="metrics">
        ${indicators.map(([label, value]) => `<div class="metric card"><label>${escapeHtml(label)}</label><strong>${escapeHtml(formatReportValue(value, '0'))}</strong></div>`).join('')}
      </div>
    </section>

    <section>
      <div class="section-kicker">Pontos de atenção</div>
      <h2>Principais pontos de atenção</h2>
      <div class="points">
        ${renderPointCard(
          'Portas de rede que exigem validação',
          summary.attentionPortsCount,
          'Portas em escuta foram destacadas quando pertencem a uma lista conservadora de serviços que merecem revisão.'
        )}
        ${renderPointCard(
          'Processos administrativos ou sensíveis observados',
          summary.sensitiveProcessesCount,
          'Ferramentas ou processos de administração podem ser esperados, mas devem ser confirmados com a equipe responsável.'
        )}
        ${renderPointCard(
          'Conexões externas que devem ser revisadas',
          summary.externalConnectionsCount,
          'Conexões para destinos externos devem ser avaliadas conforme o perfil normal de uso do equipamento.'
        )}
      </div>
    </section>

    <section class="card">
      <div class="section-kicker">Orientação inicial</div>
      <h2>Recomendações iniciais</h2>
      ${renderList(recommendations, 'Nenhuma recomendação inicial disponível.')}
    </section>

    <section>
      <div class="section-kicker">Detalhes técnicos resumidos</div>
      <h2>Portas de rede que exigem validação</h2>
      <table>
        <thead><tr><th>Porta</th><th>Serviço/Processo</th><th>Origem local</th><th>Interpretação</th></tr></thead>
        <tbody>${renderRows(analysis.attentionPorts, [
          { value: (item) => item.port },
          { value: (item) => item.process },
          { value: (item) => item.localAddress },
          { value: (item) => item.reason || 'Ponto de atenção que requer validação técnica.' }
        ], 'Nenhuma porta da lista conservadora de validação foi identificada.')}</tbody>
      </table>
    </section>

    <section>
      <h2>Processos administrativos ou sensíveis observados</h2>
      <table>
        <thead><tr><th>Processo</th><th>PID</th><th>Caminho</th><th>Interpretação</th></tr></thead>
        <tbody>${renderRows(analysis.sensitiveProcesses, [
          { value: (item) => item.name },
          { value: (item) => item.pid },
          { value: (item) => item.path || 'Não informado' },
          { value: (item) => item.reason || 'Processo administrativo ou sensível que requer validação técnica.' }
        ], 'Nenhum processo administrativo ou sensível foi destacado.')}</tbody>
      </table>
    </section>

    <section>
      <h2>Conexões externas que devem ser revisadas</h2>
      <table>
        <thead><tr><th>Processo</th><th>Destino</th><th>Porta</th><th>Observação</th></tr></thead>
        <tbody>${renderRows(analysis.externalConnections, [
          { value: (item) => item.process },
          { value: (item) => item.remoteAddress },
          { value: (item) => item.remotePort },
          { value: (item) => item.state || 'Revisão recomendada conforme o padrão esperado do ambiente.' }
        ], 'Nenhuma conexão externa relevante foi destacada.')}</tbody>
      </table>
    </section>

    <section class="card">
      <h2>Observações técnicas</h2>
      ${renderList(technicalNotes, 'Nenhuma observação técnica adicional disponível.')}
    </section>

    <section class="card">
      <h2>Próximos passos sugeridos</h2>
      ${renderList(nextSteps, 'Nenhum próximo passo sugerido.')}
    </section>

    <footer>Relatório gerado pelo Goldtech Network Behavior Scanner. Uso técnico e executivo. Não substitui antivírus, EDR, análise forense ou auditoria completa de segurança.</footer>
  </main>
</body>
</html>`;
}

async function generatePdfFromHtml(html) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.emulateMediaType('print');

    return await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '14mm',
        bottom: '14mm',
        left: '12mm',
        right: '12mm'
      }
    });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = {
  analyzeScannerResult,
  buildSummary,
  buildReportFilename,
  buildReportPdfFilename,
  calculateBufferSha256,
  detectJsonEncoding,
  deleteResultFile,
  decodeJsonBuffer,
  extractMetadata,
  getFirstBytesHex,
  getResultsStorageRoot,
  getJsonContentPreview,
  generatePdfFromHtml,
  parseJsonBuffer,
  readJsonFileFlexible,
  renderSecurityDiagnosticReportHtml,
  saveResultFile,
  sanitizeFilename
};
