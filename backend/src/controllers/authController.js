const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { db } = require('../models/db');
const { normalizeRole } = require('../middleware/auth');

exports.login = (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({ message: 'Login e senha obrigatórios' });
    }

    let settled = false;
    const timeout = setTimeout(() => {
      if (settled || res.headersSent) return;
      settled = true;
      console.error(`LOGIN TIMEOUT: database did not answer for username=${username}`);
      return res.status(503).json({ message: 'Banco de dados indisponivel. Tente novamente em instantes.' });
    }, 10000);

    db.get(
      "SELECT * FROM users WHERE username = ?",
      [username],
      (err, user) => {
        if (settled || res.headersSent) return;
        settled = true;
        clearTimeout(timeout);

        if (err) {
          console.error("DB ERROR:", err);
          return res.status(500).json({ message: 'Erro no banco' });
        }

        if (!user) {
          return res.status(401).json({ message: 'Usuário não encontrado' });
        }

        bcrypt.compare(password, user.password, (err, valid) => {

          if (err) {
            console.error("BCRYPT ERROR:", err);
            return res.status(500).json({ message: 'Erro na senha' });
          }

          if (!valid) {
            return res.status(401).json({ message: 'Senha inválida' });
          }

          const role = normalizeRole(user.role);

          const token = jwt.sign(
            { id: user.id, role },
            process.env.JWT_SECRET || 'goldtech_secret_key',
            { expiresIn: '1d' }
          );

          return res.json({
            token,
            user: {
              id: user.id,
              name: user.name,
              username: user.username,
              email: user.email,
              role
            }
          });
        });
      }
    );

  } catch (err) {
    console.error("LOGIN CRASH:", err);
    return res.status(500).json({ message: 'Erro interno' });
  }
};

exports.me = (req, res) => {
  db.get("SELECT id, name, username, email, role FROM users WHERE id = ?", [req.userId], (err, user) => {
    if (err) {
      return res.status(500).json({ message: 'Erro no servidor' });
    }
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }
    res.status(200).json({ ...user, role: normalizeRole(user.role) });
  });
};
