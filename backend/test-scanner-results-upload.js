/**
 * test-scanner-results-upload.js
 * Validacao manual dos endpoints de upload de resultado do scanner.
 *
 * Execucao: node test-scanner-results-upload.js
 * Requer backend rodando em http://localhost:3002.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_HOST = process.env.TEST_BASE_HOST || 'localhost';
const BASE_PORT = Number(process.env.TEST_BASE_PORT || process.env.PORT || 3002);
const CLIENT_ID = Number(process.env.TEST_CLIENT_ID || 1);

let TOKEN = null;
let RESULT_ID = null;

function requestJson(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: BASE_HOST,
      port: BASE_PORT,
      path: urlPath,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {})
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data), headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, body: data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function requestDownload(urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: BASE_HOST,
      port: BASE_PORT,
      path: urlPath,
      method: 'GET',
      headers: TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}
    }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, buffer: Buffer.concat(chunks), headers: res.headers }));
    });

    req.on('error', reject);
    req.end();
  });
}

function requestMultipartUpload(urlPath, filePath) {
  return new Promise((resolve, reject) => {
    const boundary = `----goldtech-${Date.now()}`;
    const fileBuffer = fs.readFileSync(filePath);
    const filename = path.basename(filePath);
    const head = Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      `Content-Type: application/json\r\n\r\n`,
      'utf8'
    );
    const tail = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
    const body = Buffer.concat([head, fileBuffer, tail]);

    const req = http.request({
      hostname: BASE_HOST,
      port: BASE_PORT,
      path: urlPath,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
        ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {})
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data), headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, body: data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function ok(message) {
  console.log(`[OK] ${message}`);
}

function fail(message, detail) {
  console.error(`[FAIL] ${message}`);
  if (detail) console.error(detail);
  process.exit(1);
}

async function login() {
  const res = await requestJson('POST', '/api/login', { username: 'admin', password: 'admin' });
  if (res.status !== 200 || !res.body.token) fail('Login falhou', res.body);
  TOKEN = res.body.token;
  ok('Login JWT realizado');
}

function createSampleJson() {
  const samplePath = path.join(__dirname, 'test-scanner-result-sample.json');
  const sample = {
    analysis_timestamp: new Date().toISOString(),
    client_id: CLIENT_ID,
    client_name: 'Goldtech Solucoes',
    scanner_version: '0.1',
    mode: 'single',
    hostname: 'TEST-WORKSTATION',
    risk_level: 'low',
    risk_score: 12,
    total_findings: 1,
    findings: [
      {
        rule_id: 'RULE-TEST',
        severity: 'low',
        description: 'Ocorrencia sintetica para validacao manual.'
      }
    ]
  };

  fs.writeFileSync(samplePath, JSON.stringify(sample, null, 2), 'utf8');
  return samplePath;
}

async function upload(samplePath) {
  const res = await requestMultipartUpload(`/api/clients/${CLIENT_ID}/security-diagnostic/results/upload`, samplePath);
  if (res.status !== 201 || !res.body.id) fail('Upload falhou', res.body);
  RESULT_ID = res.body.id;
  ok(`Upload criado com ID ${RESULT_ID}`);
  ok(`SHA256 recebido: ${res.body.sha256}`);
}

async function list() {
  const res = await requestJson('GET', `/api/clients/${CLIENT_ID}/security-diagnostic/results`);
  if (res.status !== 200 || !Array.isArray(res.body)) fail('Listagem falhou', res.body);
  if (!res.body.some(item => item.id === RESULT_ID)) fail('Resultado enviado nao apareceu na listagem', res.body);
  ok(`Listagem retornou ${res.body.length} resultado(s)`);
}

async function detail() {
  const res = await requestJson('GET', `/api/clients/${CLIENT_ID}/security-diagnostic/results/${RESULT_ID}`);
  if (res.status !== 200 || res.body.id !== RESULT_ID) fail('Detalhe falhou', res.body);
  ok(`Detalhe retornou host ${res.body.host_name} e risco ${res.body.risk_level}`);
}

async function download() {
  const res = await requestDownload(`/api/clients/${CLIENT_ID}/security-diagnostic/results/${RESULT_ID}/download`);
  if (res.status !== 200 || res.buffer.length === 0) fail('Download falhou', { status: res.status, size: res.buffer.length });
  JSON.parse(res.buffer.toString('utf8'));
  ok(`Download JSON valido com ${res.buffer.length} bytes`);
}

async function remove() {
  const res = await requestJson('DELETE', `/api/clients/${CLIENT_ID}/security-diagnostic/results/${RESULT_ID}`);
  if (res.status !== 200) fail('Delete falhou', res.body);
  ok('Resultado excluido');
}

(async () => {
  const samplePath = createSampleJson();
  try {
    await login();
    await upload(samplePath);
    await list();
    await detail();
    await download();
    await remove();
    ok('Validacao manual concluida');
  } finally {
    if (fs.existsSync(samplePath)) fs.unlinkSync(samplePath);
  }
})();
