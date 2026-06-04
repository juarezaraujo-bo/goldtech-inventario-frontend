const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const AdmZip = require('adm-zip');

/**
 * Sanitiza o nome do cliente removendo caracteres especiais e espaços.
 * @param {string} name 
 * @returns {string}
 */
function sanitizeClientName(name) {
  if (!name) return 'client';
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-zA-Z0-9-_]/g, '_') // Substitui caracteres não alfanuméricos por underline
    .replace(/_+/g, '_') // Simplifica múltiplos underlines seguidos
    .trim();
}

/**
 * Valida o modo de operação do scanner.
 * @param {string} mode 
 * @returns {boolean}
 */
function validateMode(mode) {
  const validModes = ['single', 'continuous', 'scheduled'];
  return typeof mode === 'string' && validModes.includes(mode.toLowerCase());
}

/**
 * Calcula o hash SHA256 de um arquivo físico.
 * @param {string} filePath 
 * @returns {string}
 */
function calculateSha256(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const hash = crypto.createHash('sha256');
  hash.update(fileBuffer);
  return hash.digest('hex');
}

/**
 * Constrói o objeto de configuração que será inserido dentro do scanner.
 * @param {object} clientConfig 
 * @param {object} client 
 * @returns {object}
 */
function buildScannerConfig(clientConfig, client) {
  return {
    client_id: client.id,
    client_name: client.name,
    scanner_version: clientConfig.scanner_version || '0.1',
    mode: clientConfig.mode || 'single',
    allowlist: JSON.parse(clientConfig.allowlist_json || '[]'),
    sensitive_processes: JSON.parse(clientConfig.sensitive_processes_json || '[]'),
    generated_at: new Date().toISOString()
  };
}

/**
 * Gera o pacote ZIP do scanner com a configuração inclusa.
 * @param {object} clientConfig 
 * @param {object} client 
 * @param {string} generatedBy 
 * @returns {Promise<object>}
 */
async function generatePackage(clientConfig, client, generatedBy = 'system') {
  const templateDir = path.resolve(__dirname, '../template');

  // Validar se o template existe e possui arquivos úteis além de .gitkeep
  if (!fs.existsSync(templateDir)) {
    throw new Error('Pasta de template do scanner não encontrada.');
  }

  const files = fs.readdirSync(templateDir).filter(file => file !== '.gitkeep');
  if (files.length === 0) {
    throw new Error('Não existem arquivos de template do scanner na pasta template. Por favor, adicione os arquivos do scanner antes de gerar o pacote.');
  }

  // Resolve o storage sempre relativo à raiz do projeto backend (onde fica o package.json)
  const projectRoot = path.resolve(__dirname, '../../../../');
  const storageDirSetting = process.env.SCANNER_STORAGE_PATH
    ? path.resolve(process.env.SCANNER_STORAGE_PATH)
    : path.join(projectRoot, 'storage', 'scanner-packages');

  // Cria subpasta por clientId: storage/scanner-packages/:clientId/
  const clientStorageDir = path.join(storageDirSetting, String(client.id));
  if (!fs.existsSync(clientStorageDir)) {
    fs.mkdirSync(clientStorageDir, { recursive: true });
  }

  const sanitizedName = sanitizeClientName(client.name);
  const timestamp = Date.now();
  const filename = `scanner_${client.id}_${sanitizedName}_${timestamp}.zip`;
  const filePath = path.join(clientStorageDir, filename);

  const zip = new AdmZip();

  // Adicionar arquivos de template ao ZIP
  files.forEach(file => {
    const fullPath = path.join(templateDir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isFile()) {
      zip.addLocalFile(fullPath);
    }
  });

  // Adicionar o arquivo config.json customizado no ZIP
  const scannerConfig = buildScannerConfig(clientConfig, client);
  zip.addFile('config.json', Buffer.from(JSON.stringify(scannerConfig, null, 2), 'utf8'));

  // Escrever o ZIP no diretório de destino
  zip.writeZip(filePath);

  // Calcular tamanho e hash
  const stat = fs.statSync(filePath);
  const sha256 = calculateSha256(filePath);

  return {
    client_id: client.id,
    config_id: clientConfig.id,
    scanner_version: clientConfig.scanner_version,
    mode: clientConfig.mode,
    filename,
    file_path: filePath,
    sha256,
    size_bytes: stat.size,
    generated_by: generatedBy
  };
}

/**
 * Remove o arquivo do pacote do disco.
 * @param {string} filePath 
 */
function deletePackageFile(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

module.exports = {
  sanitizeClientName,
  validateMode,
  calculateSha256,
  buildScannerConfig,
  generatePackage,
  deletePackageFile
};
