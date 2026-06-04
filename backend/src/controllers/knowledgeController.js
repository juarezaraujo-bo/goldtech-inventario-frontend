const { db } = require('../models/db');

const ALLOWED_AUDIENCES = new Set(['interno_goldtech', 'visivel_cliente']);
const ALLOWED_STATUSES = new Set(['rascunho', 'publicado']);

exports.getArticles = (req, res) => {
  const { category, q, status, audience } = req.query;
  const params = [];
  const conditions = [];

  if (category) {
    conditions.push('a.category = ?');
    params.push(category);
  }

  if (status) {
    conditions.push('a.status = ?');
    params.push(status);
  }

  if (audience) {
    conditions.push('a.audience = ?');
    params.push(audience);
  }

  if (q) {
    conditions.push('(a.title LIKE ? OR a.summary LIKE ? OR a.content LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  db.all(
    `SELECT a.*, u.name AS created_by_name
     FROM knowledge_articles a
     LEFT JOIN users u ON u.id = a.created_by
     ${where}
     ORDER BY a.updated_at DESC, a.created_at DESC`,
    params,
    (err, rows) => {
      if (err) return res.status(500).json({ message: err.message });
      res.json(rows);
    }
  );
};

exports.getArticleById = (req, res) => {
  db.get(
    `SELECT a.*, u.name AS created_by_name
     FROM knowledge_articles a
     LEFT JOIN users u ON u.id = a.created_by
     WHERE a.id = ?`,
    [req.params.id],
    (err, row) => {
      if (err) return res.status(500).json({ message: err.message });
      if (!row) return res.status(404).json({ message: 'Artigo nao encontrado.' });
      res.json(row);
    }
  );
};

exports.createArticle = (req, res) => {
  const { title, category, summary, content, audience, status } = req.body;
  const normalizedAudience = audience || 'interno_goldtech';
  const normalizedStatus = status || 'rascunho';

  if (!title || !content) {
    return res.status(400).json({ message: 'Titulo e conteudo sao obrigatorios.' });
  }

  if (!ALLOWED_AUDIENCES.has(normalizedAudience)) {
    return res.status(400).json({ message: 'Publico invalido.' });
  }

  if (!ALLOWED_STATUSES.has(normalizedStatus)) {
    return res.status(400).json({ message: 'Status invalido.' });
  }

  db.run(
    `INSERT INTO knowledge_articles
     (title, category, summary, content, audience, status, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      title.trim(),
      (category || 'Geral').trim(),
      (summary || '').trim(),
      content.trim(),
      normalizedAudience,
      normalizedStatus,
      req.userId,
      req.userId
    ],
    function (err) {
      if (err) return res.status(500).json({ message: err.message });
      res.status(201).json({ success: true, id: this.lastID });
    }
  );
};

exports.updateArticle = (req, res) => {
  const { title, category, summary, content, audience, status } = req.body;
  const normalizedAudience = audience || 'interno_goldtech';
  const normalizedStatus = status || 'rascunho';

  if (!title || !content) {
    return res.status(400).json({ message: 'Titulo e conteudo sao obrigatorios.' });
  }

  if (!ALLOWED_AUDIENCES.has(normalizedAudience)) {
    return res.status(400).json({ message: 'Publico invalido.' });
  }

  if (!ALLOWED_STATUSES.has(normalizedStatus)) {
    return res.status(400).json({ message: 'Status invalido.' });
  }

  db.run(
    `UPDATE knowledge_articles
     SET title = ?, category = ?, summary = ?, content = ?, audience = ?, status = ?,
         updated_by = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      title.trim(),
      (category || 'Geral').trim(),
      (summary || '').trim(),
      content.trim(),
      normalizedAudience,
      normalizedStatus,
      req.userId,
      req.params.id
    ],
    function (err) {
      if (err) return res.status(500).json({ message: err.message });
      if (this.changes === 0) return res.status(404).json({ message: 'Artigo nao encontrado.' });
      res.json({ success: true, message: 'Artigo atualizado.' });
    }
  );
};

exports.deleteArticle = (req, res) => {
  db.run('DELETE FROM knowledge_articles WHERE id = ?', [req.params.id], function (err) {
    if (err) return res.status(500).json({ message: err.message });
    if (this.changes === 0) return res.status(404).json({ message: 'Artigo nao encontrado.' });
    res.json({ success: true, message: 'Artigo removido.' });
  });
};
