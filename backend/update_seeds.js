const { db, initDb } = require('./src/models/db');

db.serialize(() => {
  // GT-001: Obsolete CPU, OS and RAM
  db.run(`UPDATE equipments SET 
    processador = 'Intel Core i5-4210U', 
    sistema_operacional = 'Windows 7 Professional', 
    memoria_ram = '4GB', 
    ultima_coleta = '2024-01-15' 
    WHERE patrimonio = 'GT-001'`);

  // GT-002: Obsolete Server OS and low RAM for server
  db.run(`UPDATE equipments SET 
    processador = 'Xeon E5-2620 v2', 
    sistema_operacional = 'Windows Server 2012 R2', 
    memoria_ram = '8GB', 
    ultima_coleta = '2024-03-20' 
    WHERE patrimonio = 'GT-002'`);

  // BF-101: Modern
  db.run(`UPDATE equipments SET 
    processador = 'Intel Core i7-12700', 
    sistema_operacional = 'Windows 11 Pro', 
    memoria_ram = '32GB', 
    ultima_coleta = '2026-04-29' 
    WHERE patrimonio = 'BF-101'`);

  // GT-003: No collection
  db.run(`UPDATE equipments SET ultima_coleta = NULL WHERE patrimonio = 'GT-003'`);

  console.log('Database updated with audit test data.');
});
