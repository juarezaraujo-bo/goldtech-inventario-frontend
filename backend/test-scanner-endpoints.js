/**
 * test-scanner-endpoints.js
 * Script de validação end-to-end da Etapa 2 do Goldtech Scanner.
 * 
 * Execução: node test-scanner-endpoints.js
 * (Rodar com o backend já em execução na porta 3002)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3002';
const CLIENT_ID = 1; // ID do cliente de teste (Goldtech Solucoes)

let TOKEN = null;
let PACKAGE_ID = null;

// ── Utilitários HTTP ────────────────────────────────────────────────────────

function request(method, urlPath, body, isDownload) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3002,
      path: urlPath,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {})
      }
    };

    const req = http.request(options, (res) => {
      if (isDownload) {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => resolve({ status: res.statusCode, buffer: Buffer.concat(chunks), headers: res.headers }));
        return;
      }
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function ok(label) { console.log(`  ✅ ${label}`); }
function fail(label, detail) { console.log(`  ❌ ${label}`); if (detail) console.log(`     → ${JSON.stringify(detail)}`); }
function section(title) { console.log(`\n${'─'.repeat(52)}\n ${title}\n${'─'.repeat(52)}`); }

// ── Testes ──────────────────────────────────────────────────────────────────

async function testLogin() {
  section('1. LOGIN E OBTENÇÃO DO TOKEN JWT');
  const res = await request('POST', '/api/login', { username: 'admin', password: 'admin' });
  if (res.status === 200 && res.body.token) {
    TOKEN = res.body.token;
    ok(`Login realizado. Token obtido (${TOKEN.slice(0, 20)}...)`);
  } else {
    fail('Login falhou', res.body);
    process.exit(1);
  }
}

async function testGetConfig() {
  section(`2. GET CONFIG  /api/clients/${CLIENT_ID}/security-diagnostic/config`);
  const res = await request('GET', `/api/clients/${CLIENT_ID}/security-diagnostic/config`);
  if (res.status === 200) {
    ok(`Config retornada — modo: ${res.body.mode}, versão: ${res.body.scanner_version}`);
    console.log('  Dados:', JSON.stringify(res.body, null, 2).replace(/\n/g, '\n  '));
  } else {
    fail('Falha ao obter config', res.body);
  }
}

async function testPutConfig() {
  section(`3. PUT CONFIG  /api/clients/${CLIENT_ID}/security-diagnostic/config`);
  const payload = {
    scanner_version: '0.1',
    mode: 'single',
    allowlist_json: '[80, 443, 3389, 3306]',
    sensitive_processes_json: '["mimikatz", "netcat", "nmap"]',
    notes: 'Configuração de teste — Etapa 2'
  };
  const res = await request('PUT', `/api/clients/${CLIENT_ID}/security-diagnostic/config`, payload);
  if (res.status === 200) {
    ok(`Config salva — modo: ${res.body.mode}, versão: ${res.body.scanner_version}`);
    ok(`Allowlist: ${res.body.allowlist_json}`);
    ok(`Processos sensíveis: ${res.body.sensitive_processes_json}`);
  } else {
    fail('Falha ao salvar config', res.body);
  }
}

async function testPostPackage() {
  section(`4. POST PACKAGE  /api/clients/${CLIENT_ID}/security-diagnostic/packages`);
  const res = await request('POST', `/api/clients/${CLIENT_ID}/security-diagnostic/packages`, {});
  if (res.status === 201) {
    PACKAGE_ID = res.body.id;
    ok(`Pacote gerado com ID: ${PACKAGE_ID}`);
    ok(`Filename : ${res.body.filename}`);
    ok(`Versão   : ${res.body.scanner_version}`);
    ok(`Modo     : ${res.body.mode}`);
    ok(`SHA256   : ${res.body.sha256}`);
    ok(`Tamanho  : ${res.body.size_bytes} bytes`);
    ok(`Gerado por: ${res.body.generated_by}`);
    ok(`Data     : ${res.body.created_at}`);
  } else {
    fail('Falha ao gerar pacote', res.body);
    process.exit(1);
  }
}

async function testListPackages() {
  section(`5. GET PACKAGES  /api/clients/${CLIENT_ID}/security-diagnostic/packages`);
  const res = await request('GET', `/api/clients/${CLIENT_ID}/security-diagnostic/packages`);
  if (res.status === 200 && Array.isArray(res.body)) {
    const found = res.body.find(p => p.id === PACKAGE_ID);
    if (found) {
      ok(`Listagem retornou ${res.body.length} pacote(s). Pacote gerado está na lista.`);
      console.log(`  Pacote: ${found.filename} | ${found.size_bytes} bytes | ${found.sha256.slice(0, 16)}...`);
    } else {
      fail('Pacote gerado NÃO está na listagem', res.body);
    }
  } else {
    fail('Falha ao listar pacotes', res.body);
  }
}

async function testDownload() {
  section(`6. DOWNLOAD  /api/clients/${CLIENT_ID}/security-diagnostic/packages/${PACKAGE_ID}/download`);
  const res = await request('GET', `/api/clients/${CLIENT_ID}/security-diagnostic/packages/${PACKAGE_ID}/download`, null, true);
  if (res.status === 200 && res.buffer.length > 0) {
    // Verifica assinatura do ZIP (magic bytes PK\x03\x04)
    const isPK = res.buffer[0] === 0x50 && res.buffer[1] === 0x4B;
    const downloadPath = path.join(__dirname, `test-download-pkg-${PACKAGE_ID}.zip`);
    fs.writeFileSync(downloadPath, res.buffer);
    ok(`Download bem-sucedido — ${res.buffer.length} bytes recebidos.`);
    ok(`Assinatura ZIP (PK): ${isPK ? 'SIM ✓' : 'NÃO ✗'}`);
    ok(`Arquivo salvo localmente em: ${downloadPath}`);

    // Verifica conteúdo do ZIP via AdmZip
    try {
      const AdmZip = require('adm-zip');
      const zip = new AdmZip(downloadPath);
      const entries = zip.getEntries().map(e => e.entryName);
      console.log('\n  Arquivos dentro do ZIP:');
      entries.forEach(e => console.log(`    📄 ${e}`));

      const required = [
        'Goldtech-BehaviorCollector.ps1',
        'Goldtech-AnalyzeBaseline.ps1',
        'Start-GoldtechScan.ps1',
        'Executar-Diagnostico.bat',
        'risk-rules.json',
        'README.md',
        'checklist-operacional.md',
        'LEIA-ME-TECNICO.txt',
        'config.json'
      ];
      console.log('');
      required.forEach(file => {
        if (entries.includes(file)) ok(`ZIP contém: ${file}`);
        else fail(`ZIP NÃO contém: ${file}`);
      });

      // Lê e mostra o config.json do ZIP
      const configEntry = zip.getEntry('config.json');
      if (configEntry) {
        const config = JSON.parse(configEntry.getData().toString('utf8'));
        console.log('\n  config.json gerado dentro do ZIP:');
        console.log('  ' + JSON.stringify(config, null, 2).replace(/\n/g, '\n  '));
      }
    } catch (err) {
      fail('Erro ao inspecionar o ZIP', err.message);
    }

    // Limpa o arquivo de download local de teste
    fs.unlinkSync(downloadPath);
  } else {
    fail('Falha no download', { status: res.status, size: res.buffer?.length });
  }
}

async function testDelete() {
  section(`7. DELETE  /api/clients/${CLIENT_ID}/security-diagnostic/packages/${PACKAGE_ID}`);
  const res = await request('DELETE', `/api/clients/${CLIENT_ID}/security-diagnostic/packages/${PACKAGE_ID}`);
  if (res.status === 200) {
    ok(`Exclusão bem-sucedida: ${res.body.message}`);

    // Confirma que sumiu da listagem
    const listRes = await request('GET', `/api/clients/${CLIENT_ID}/security-diagnostic/packages`);
    if (Array.isArray(listRes.body)) {
      const found = listRes.body.find(p => p.id === PACKAGE_ID);
      if (!found) ok('Pacote removido da listagem corretamente.');
      else fail('Pacote ainda aparece na listagem após exclusão!');
    }
  } else {
    fail('Falha ao excluir pacote', res.body);
  }
}

// ── Runner ──────────────────────────────────────────────────────────────────

(async () => {
  console.log('\n══════════════════════════════════════════════════');
  console.log('  Goldtech Scanner — Validação de Endpoints (Etapa 2)');
  console.log('══════════════════════════════════════════════════');
  try {
    await testLogin();
    await testGetConfig();
    await testPutConfig();
    await testPostPackage();
    await testListPackages();
    await testDownload();
    await testDelete();
    console.log('\n══════════════════════════════════════════════════');
    console.log('  Validação concluída!');
    console.log('══════════════════════════════════════════════════\n');
  } catch (err) {
    console.error('\n[ERRO INESPERADO]', err.message);
    process.exit(1);
  }
})();
