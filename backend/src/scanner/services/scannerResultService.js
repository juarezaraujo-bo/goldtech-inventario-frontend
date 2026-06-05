const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MAX_SUMMARY_FINDINGS = 20;

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
  const riskLevel = pickString(json, ['risk_level', 'riskLevel', 'summary.riskLevel']);
  const riskScore = pickInteger(json, ['risk_score', 'riskScore', 'summary.riskScore', 'score']);

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
    risk_level: pickString(json, ['risk_level', 'riskLevel', 'summary.riskLevel']),
    risk_score: pickInteger(json, ['risk_score', 'riskScore', 'summary.riskScore', 'score']),
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
