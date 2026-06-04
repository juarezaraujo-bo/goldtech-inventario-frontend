const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.resolve(__dirname, '../database/inventory.sqlite');
const db = new sqlite3.Database(dbPath);

const ADMIN_USER = {
  username: 'admin',
  email: 'admin@goldtech.local',
  password: 'admin', // Texto puro para compatibilidade imediata ou hash
  name: 'Administrador',
  role: 'admin'
};

function resetAdmin() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Garantir tabela
      db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        username TEXT UNIQUE,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user'
      )`);

      const hash = bcrypt.hashSync(ADMIN_USER.password, 10);

      // Tentar atualizar
      db.run(`UPDATE users SET password = ?, name = ?, role = ?, email = ? WHERE username = ?`,
        [hash, ADMIN_USER.name, ADMIN_USER.role, ADMIN_USER.email, ADMIN_USER.username],
        function(err) {
          if (err) return reject(err);
          
          if (this.changes === 0) {
            // Se não atualizou nada, inserir
            db.run(`INSERT INTO users (name, username, email, password, role) VALUES (?, ?, ?, ?, ?)`,
              [ADMIN_USER.name, ADMIN_USER.username, ADMIN_USER.email, hash, ADMIN_USER.role],
              function(err2) {
                if (err2) return reject(err2);
                resolve('Usuário inserido');
              }
            );
          } else {
            resolve('Usuário atualizado');
          }
        }
      );
    });
  });
}

if (require.main === module) {
  console.log('--- RESET ADMIN ---');
  resetAdmin()
    .then(msg => {
      console.log('Sucesso:', msg);
      db.close();
    })
    .catch(err => {
      console.error('Erro:', err.message);
      db.close();
    });
}

module.exports = { resetAdmin };
