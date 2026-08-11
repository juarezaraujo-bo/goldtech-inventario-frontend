const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dbPath = process.env.DB_PATH
  ? path.resolve(__dirname, '../../', process.env.DB_PATH)
  : path.resolve(__dirname, '../../../database/inventory.sqlite');

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const isRender = process.env.RENDER || process.env.RENDER_SERVICE_ID || process.env.RENDER_EXTERNAL_URL;
const isRenderPersistentPath = dbPath.startsWith('/var/data/');

if (isRender && !isRenderPersistentPath) {
  console.warn(
    `[DATABASE WARNING] Render detectado usando SQLite fora de /var/data: ${dbPath}. ` +
    'Configure um Persistent Disk montado em /var/data e defina DB_PATH=/var/data/inventory.sqlite para evitar perda de dados em restart/deploy.'
  );
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('Database connection error:', err.message);
  else console.log(`Connected to SQLite database: ${dbPath}`);
});

db.configure('busyTimeout', 5000);

const run = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function(err) {
    if (err) reject(err);
    else resolve(this);
  });
});

const get = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => {
    if (err) reject(err);
    else resolve(row);
  });
});

const initDb = async () => {
  await run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    username TEXT UNIQUE,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'user'
  )`);

  await run(`CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    cnpj TEXT,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    observations TEXT,
    status TEXT DEFAULT 'Ativo'
  )`);

  await run(`CREATE TABLE IF NOT EXISTS equipments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER,
    nome TEXT NOT NULL,
    categoria TEXT,
    categoria_manual INTEGER DEFAULT 0,
    tipo TEXT,
    fabricante TEXT,
    modelo TEXT,
    numero_serie TEXT,
    patrimonio TEXT UNIQUE,
    usuario_responsavel TEXT,
    localizacao TEXT,
    setor TEXT,
    status TEXT DEFAULT 'Ativo',
    data_aquisicao TEXT,
    garantia TEXT,
    observacoes TEXT,
    sistema_operacional TEXT,
    processador TEXT,
    memoria_ram TEXT,
    armazenamento TEXT,
    disco_livre_gb TEXT,
    bios_versao TEXT,
    bios_data TEXT,
    placa_mae TEXT,
    data_instalacao_os TEXT,
    ultima_inicializacao TEXT,
    ip TEXT,
    mac TEXT,
    dominio TEXT,
    antivirus TEXT,
    ultima_coleta TEXT,
    origem_cadastro TEXT DEFAULT 'manual',
    FOREIGN KEY (client_id) REFERENCES clients (id)
  )`);

  await run(`CREATE TABLE IF NOT EXISTS equipment_performance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    equipment_id INTEGER,
    cpu_usage_percent REAL,
    memory_usage_percent REAL,
    disk_free_percent REAL,
    disk_free_gb REAL,
    network_usage TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (equipment_id) REFERENCES equipments (id)
  )`);

  await run(`CREATE TABLE IF NOT EXISTS network_discovered_assets (
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
  )`);

  await run(`CREATE INDEX IF NOT EXISTS idx_network_discovered_assets_client
    ON network_discovered_assets (client_id)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_network_discovered_assets_client_ip
    ON network_discovered_assets (client_id, ip_address)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_network_discovered_assets_client_mac
    ON network_discovered_assets (client_id, mac_address)`);

  const networkAssetColumns = await new Promise((resolve, reject) => {
    db.all(`PRAGMA table_info(network_discovered_assets)`, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows.map((row) => row.name));
    });
  });

  if (!networkAssetColumns.includes('documentation_status')) {
    await run(`ALTER TABLE network_discovered_assets ADD COLUMN documentation_status TEXT DEFAULT 'pending'`);
  }
  if (!networkAssetColumns.includes('documentation_ref_id')) {
    await run(`ALTER TABLE network_discovered_assets ADD COLUMN documentation_ref_id INTEGER`);
  }
  if (!networkAssetColumns.includes('imported_at')) {
    await run(`ALTER TABLE network_discovered_assets ADD COLUMN imported_at DATETIME`);
  }
  if (!networkAssetColumns.includes('is_collector')) {
    await run(`ALTER TABLE network_discovered_assets ADD COLUMN is_collector INTEGER DEFAULT 0`);
  }
  if (!networkAssetColumns.includes('collector_hostname')) {
    await run(`ALTER TABLE network_discovered_assets ADD COLUMN collector_hostname TEXT`);
  }
  if (!networkAssetColumns.includes('local_ip')) {
    await run(`ALTER TABLE network_discovered_assets ADD COLUMN local_ip TEXT`);
  }
  if (!networkAssetColumns.includes('interface_alias')) {
    await run(`ALTER TABLE network_discovered_assets ADD COLUMN interface_alias TEXT`);
  }
  if (!networkAssetColumns.includes('already_in_inventory')) {
    await run(`ALTER TABLE network_discovered_assets ADD COLUMN already_in_inventory INTEGER DEFAULT 0`);
  }
  if (!networkAssetColumns.includes('equipment_id')) {
    await run(`ALTER TABLE network_discovered_assets ADD COLUMN equipment_id INTEGER`);
  }

  await run(`CREATE TABLE IF NOT EXISTS inventory_tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    equipment_id INTEGER,
    motivo_hash TEXT,
    status TEXT DEFAULT 'aberto',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (equipment_id) REFERENCES equipments (id)
  )`);

  await run(`CREATE TABLE IF NOT EXISTS monitoring_helpdesk_tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    equipment_id INTEGER NOT NULL,
    client_id INTEGER,
    alert_type TEXT NOT NULL,
    helpdesk_ticket_id TEXT,
    status TEXT DEFAULT 'aberto',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (equipment_id) REFERENCES equipments (id)
  )`);

  await run(`CREATE TABLE IF NOT EXISTS intranet_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    category TEXT DEFAULT 'Geral',
    content TEXT NOT NULL,
    visibility TEXT DEFAULT 'interno_goldtech',
    created_by INTEGER,
    updated_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients (id),
    FOREIGN KEY (created_by) REFERENCES users (id),
    FOREIGN KEY (updated_by) REFERENCES users (id)
  )`);

  await run(`CREATE TABLE IF NOT EXISTS knowledge_articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    category TEXT DEFAULT 'Geral',
    summary TEXT,
    content TEXT NOT NULL,
    audience TEXT DEFAULT 'interno_goldtech',
    status TEXT DEFAULT 'rascunho',
    created_by INTEGER,
    updated_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users (id),
    FOREIGN KEY (updated_by) REFERENCES users (id)
  )`);

  await run(`CREATE TABLE IF NOT EXISTS maintenance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    equipment_id INTEGER,
    date TEXT,
    type TEXT,
    description TEXT,
    technician TEXT,
    cost REAL,
    FOREIGN KEY (equipment_id) REFERENCES equipments (id)
  )`);

  const juarez = await get('SELECT id FROM users WHERE username = ?', ['juarez@goldtechnologia.com.br']);
  if (!juarez) {
    const hash = await bcrypt.hash('Goldtech@123', 10);
    await run(
      `INSERT OR IGNORE INTO users (name, username, email, password, role) VALUES (?, ?, ?, ?, ?)`,
      ['Juarez Diniz', 'juarez@goldtechnologia.com.br', 'juarez@goldtechnologia.com.br', hash, 'admin']
    );
  }

  const admin = await get('SELECT id FROM users WHERE username = ?', ['admin']);
  if (!admin) {
    const hash = await bcrypt.hash('admin', 10);
    await run(
      `INSERT OR IGNORE INTO users (name, username, email, password, role) VALUES (?, ?, ?, ?, ?)`,
      ['Administrador', 'admin', 'admin@goldtech.local', hash, 'admin']
    );
  }

  await run(`UPDATE users SET role = 'admin' WHERE role = 'admin_goldtech'`);
  await run(`UPDATE users SET role = 'goldtech_team' WHERE role IN ('tecnico', 'tecnico_goldtech')`);
  await run(`UPDATE users SET role = 'user' WHERE role IS NULL OR role NOT IN ('admin', 'goldtech_team', 'user')`);

  try {
    await run(`DELETE FROM users WHERE email = 'admin@goldtech.com'`);
  } catch (err) {
    console.warn(`Could not remove legacy admin user: ${err.message}`);
  }

  const clientCount = await get('SELECT COUNT(*) as count FROM clients');
  if (clientCount.count === 0) {
    await run(`INSERT INTO clients (name, cnpj, contact_person, status) VALUES (?, ?, ?, ?)`, ['Goldtech Solucoes', '12.345.678/0001-90', 'Carlos Silva', 'Ativo']);
    await run(`INSERT INTO clients (name, cnpj, contact_person, status) VALUES (?, ?, ?, ?)`, ['Banco Futuro', '98.765.432/0001-10', 'Ana Oliveira', 'Ativo']);
    await run(`INSERT INTO clients (name, cnpj, contact_person, status) VALUES (?, ?, ?, ?)`, ['Industrias Alpha', '55.444.333/0001-22', 'Marcos Santos', 'Ativo']);
  }

  const equipmentCount = await get('SELECT COUNT(*) as count FROM equipments');
  if (equipmentCount.count === 0) {
    await run(`INSERT INTO equipments (client_id, nome, categoria, tipo, fabricante, modelo, patrimonio, status, ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [1, 'Notebook Direcao', 'Notebooks', 'Laptop', 'Dell', 'Latitude 5420', 'GT-001', 'Ativo', '192.168.1.15']);
    await run(`INSERT INTO equipments (client_id, nome, categoria, tipo, fabricante, modelo, patrimonio, status, ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [1, 'Servidor Arquivos', 'Servidores', 'Rack', 'HP', 'ProLiant DL380', 'GT-002', 'Ativo', '192.168.1.100']);
    await run(`INSERT INTO equipments (client_id, nome, categoria, tipo, fabricante, modelo, patrimonio, status, ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [1, 'Switch Core', 'Ativos de Rede', 'Switch', 'Cisco', 'Catalyst 9300', 'GT-003', 'Ativo', '192.168.1.1']);
    await run(`INSERT INTO equipments (client_id, nome, categoria, tipo, fabricante, modelo, patrimonio, status, ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [2, 'Workstation Dev 1', 'Desktops', 'Workstation', 'HP', 'Z2 G9', 'BF-101', 'Ativo', '10.0.0.50']);
    await run(`INSERT INTO equipments (client_id, nome, categoria, tipo, fabricante, modelo, patrimonio, status, ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [2, 'Roteador Borda', 'Roteadores', 'Router', 'MikroTik', 'CCR2004', 'BF-102', 'Ativo', '10.0.0.1']);
  }

  const perfCount = await get('SELECT COUNT(*) as count FROM equipment_performance');
  if (perfCount.count === 0) {
    await run(`INSERT INTO equipment_performance (equipment_id, cpu_usage_percent, memory_usage_percent, disk_free_percent, disk_free_gb) VALUES (?, ?, ?, ?, ?)`, [1, 45.5, 60.2, 75.0, 180.0]);
    await run(`INSERT INTO equipment_performance (equipment_id, cpu_usage_percent, memory_usage_percent, disk_free_percent, disk_free_gb) VALUES (?, ?, ?, ?, ?)`, [2, 92.0, 85.0, 40.0, 1600.0]);
    await run(`INSERT INTO equipment_performance (equipment_id, cpu_usage_percent, memory_usage_percent, disk_free_percent, disk_free_gb) VALUES (?, ?, ?, ?, ?)`, [4, 15.0, 95.0, 80.0, 400.0]);
    await run(`INSERT INTO equipment_performance (equipment_id, cpu_usage_percent, memory_usage_percent, disk_free_percent, disk_free_gb) VALUES (?, ?, ?, ?, ?)`, [5, 10.0, 20.0, 5.0, 20.0]);
  }

  await run(`CREATE TABLE IF NOT EXISTS client_scanner_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    scanner_version TEXT NOT NULL DEFAULT '0.1',
    mode TEXT NOT NULL DEFAULT 'single',
    allowlist_json TEXT NOT NULL DEFAULT '[]',
    sensitive_processes_json TEXT NOT NULL DEFAULT '[]',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS scanner_packages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    config_id INTEGER,
    scanner_version TEXT NOT NULL,
    mode TEXT NOT NULL,
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    size_bytes INTEGER,
    generated_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS scanner_diagnostic_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    package_id INTEGER,
    original_filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    size_bytes INTEGER,
    scanner_version TEXT,
    mode TEXT,
    host_name TEXT,
    collected_at TEXT,
    risk_level TEXT,
    risk_score INTEGER,
    summary_json TEXT,
    uploaded_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  console.log('Database initialized.');
};

module.exports = { db, dbPath, initDb };
