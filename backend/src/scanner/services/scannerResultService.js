const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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

module.exports = {
  analyzeScannerResult,
  buildSummary,
  calculateBufferSha256,
  detectJsonEncoding,
  deleteResultFile,
  decodeJsonBuffer,
  extractMetadata,
  getFirstBytesHex,
  getResultsStorageRoot,
  getJsonContentPreview,
  parseJsonBuffer,
  readJsonFileFlexible,
  saveResultFile,
  sanitizeFilename
};
