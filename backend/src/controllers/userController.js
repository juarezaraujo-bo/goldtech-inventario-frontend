const bcrypt = require('bcryptjs');
const { db } = require('../models/db');
const { normalizeRole } = require('../middleware/auth');

const ALLOWED_ROLES = new Set(['admin', 'goldtech_team', 'user']);

const sanitizeRole = (role) => {
  const normalizedRole = normalizeRole(role);
  return ALLOWED_ROLES.has(normalizedRole) ? normalizedRole : 'user';
};

const getAdminCount = (callback) => {
  db.get("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'", [], (err, row) => {
    if (err) return callback(err);
    callback(null, row?.count || 0);
  });
};

exports.getAll = (req, res) => {
  db.all("SELECT id, name, username, email, role FROM users ORDER BY id ASC", [], (err, rows) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json(rows);
  });
};

exports.create = (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Nome, email e senha sao obrigatorios.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: 'A senha deve ter pelo menos 6 caracteres.' });
  }

  const username = email.trim().toLowerCase();
  const hashedPassword = bcrypt.hashSync(password, 10);
  const userRole = sanitizeRole(role);

  db.run(
    "INSERT INTO users (name, username, email, password, role) VALUES (?, ?, ?, ?, ?)",
    [name, username, username, hashedPassword, userRole],
    function (err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ message: 'Este e-mail/usuario ja esta em uso.' });
        }
        return res.status(500).json({ message: err.message });
      }
      res.status(201).json({ success: true, id: this.lastID, name, username, email: username, role: userRole });
    }
  );
};

exports.update = (req, res) => {
  const { id } = req.params;
  const { name, email, role } = req.body;

  if (!name || !email) {
    return res.status(400).json({ message: 'Nome e e-mail sao obrigatorios.' });
  }

  const username = email.trim().toLowerCase();
  const userRole = sanitizeRole(role);

  db.get("SELECT id, role FROM users WHERE id = ?", [id], (err, existingUser) => {
    if (err) return res.status(500).json({ message: err.message });
    if (!existingUser) return res.status(404).json({ message: 'Usuario nao encontrado.' });

    const updateUser = () => {
      db.run(
        "UPDATE users SET name = ?, username = ?, email = ?, role = ? WHERE id = ?",
        [name, username, username, userRole, id],
        function (err) {
          if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
              return res.status(400).json({ message: 'Este e-mail/usuario ja esta em uso.' });
            }
            return res.status(500).json({ message: err.message });
          }
          if (this.changes === 0) return res.status(404).json({ message: 'Usuario nao encontrado.' });
          res.json({ success: true, message: 'Usuario atualizado.' });
        }
      );
    };

    if (existingUser.role === 'admin' && userRole !== 'admin') {
      return getAdminCount((err, adminCount) => {
        if (err) return res.status(500).json({ message: err.message });
        if (adminCount <= 1) {
          return res.status(400).json({ message: 'Nao e possivel rebaixar o ultimo administrador.' });
        }
        updateUser();
      });
    }

    updateUser();
  });
};

exports.changePassword = (req, res) => {
  const { current_password, new_password } = req.body;
  const userId = req.userId;

  if (!current_password || !new_password) {
    return res.status(400).json({ message: 'Senha atual e nova senha sao obrigatorias.' });
  }

  if (new_password.length < 6) {
    return res.status(400).json({ message: 'A nova senha deve ter pelo menos 6 caracteres.' });
  }

  db.get("SELECT * FROM users WHERE id = ?", [userId], (err, user) => {
    if (err) return res.status(500).json({ message: err.message });
    if (!user) return res.status(404).json({ message: 'Usuario nao encontrado.' });

    const valid = bcrypt.compareSync(current_password, user.password);
    if (!valid) {
      return res.status(401).json({ message: 'Senha atual incorreta.' });
    }

    const hashedNew = bcrypt.hashSync(new_password, 10);
    db.run("UPDATE users SET password = ? WHERE id = ?", [hashedNew, userId], function (err) {
      if (err) return res.status(500).json({ message: err.message });
      res.json({ success: true, message: 'Senha alterada com sucesso.' });
    });
  });
};

exports.setPassword = (req, res) => {
  const { id } = req.params;
  const { new_password } = req.body;

  if (!new_password) {
    return res.status(400).json({ message: 'Nova senha e obrigatoria.' });
  }

  if (new_password.length < 6) {
    return res.status(400).json({ message: 'A nova senha deve ter pelo menos 6 caracteres.' });
  }

  const hashedNew = bcrypt.hashSync(new_password, 10);
  db.run("UPDATE users SET password = ? WHERE id = ?", [hashedNew, id], function (err) {
    if (err) return res.status(500).json({ message: err.message });
    if (this.changes === 0) return res.status(404).json({ message: 'Usuario nao encontrado.' });
    res.json({ success: true, message: 'Senha redefinida com sucesso.' });
  });
};

exports.remove = (req, res) => {
  const { id } = req.params;

  if (Number(id) === req.userId) {
    return res.status(400).json({ message: 'Voce nao pode excluir seu proprio usuario.' });
  }

  db.get("SELECT id, role FROM users WHERE id = ?", [id], (err, user) => {
    if (err) return res.status(500).json({ message: err.message });
    if (!user) return res.status(404).json({ message: 'Usuario nao encontrado.' });

    const deleteUser = () => {
      db.run("DELETE FROM users WHERE id = ?", [id], function (err) {
        if (err) return res.status(500).json({ message: err.message });
        if (this.changes === 0) return res.status(404).json({ message: 'Usuario nao encontrado.' });
        res.json({ success: true, message: 'Usuario excluido.' });
      });
    };

    if (user.role === 'admin') {
      return getAdminCount((err, adminCount) => {
        if (err) return res.status(500).json({ message: err.message });
        if (adminCount <= 1) {
          return res.status(400).json({ message: 'Nao e possivel excluir o ultimo administrador.' });
        }
        deleteUser();
      });
    }

    deleteUser();
  });
};
