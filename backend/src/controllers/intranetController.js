const { db } = require('../models/db');

const ALLOWED_VISIBILITIES = new Set(['interno_goldtech', 'base_cliente']);

exports.getDocuments = (req, res) => {
  const { client_id, category, q } = req.query;
  const params = [];
  const conditions = [];

  if (client_id) {
    conditions.push('d.client_id = ?');
    params.push(client_id);
  }

  if (category) {
    conditions.push('d.category = ?');
    params.push(category);
  }

  if (q) {
    conditions.push('(d.title LIKE ? OR d.content LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  db.all(
    `SELECT d.*, c.name AS client_name, u.name AS created_by_name
     FROM intranet_documents d
     JOIN clients c ON c.id = d.client_id
     LEFT JOIN users u ON u.id = d.created_by
     ${where}
     ORDER BY d.updated_at DESC, d.created_at DESC`,
    params,
    (err, rows) => {
      if (err) return res.status(500).json({ message: err.message });
      res.json(rows);
    }
  );
};

exports.getDocumentById = (req, res) => {
  db.get(
    `SELECT d.*, c.name AS client_name, u.name AS created_by_name
     FROM intranet_documents d
     JOIN clients c ON c.id = d.client_id
     LEFT JOIN users u ON u.id = d.created_by
     WHERE d.id = ?`,
    [req.params.id],
    (err, row) => {
      if (err) return res.status(500).json({ message: err.message });
      if (!row) return res.status(404).json({ message: 'Documento nao encontrado.' });
      res.json(row);
    }
  );
};

exports.createDocument = (req, res) => {
  const { client_id, title, category, content, visibility } = req.body;
  const normalizedVisibility = visibility || 'interno_goldtech';

  if (!client_id || !title || !content) {
    return res.status(400).json({ message: 'Cliente, titulo e conteudo sao obrigatorios.' });
  }

  if (!ALLOWED_VISIBILITIES.has(normalizedVisibility)) {
    return res.status(400).json({ message: 'Visibilidade invalida.' });
  }

  db.run(
    `INSERT INTO intranet_documents
     (client_id, title, category, content, visibility, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      client_id,
      title.trim(),
      (category || 'Geral').trim(),
      content.trim(),
      normalizedVisibility,
      req.userId,
      req.userId
    ],
    function (err) {
      if (err) return res.status(500).json({ message: err.message });
      res.status(201).json({ success: true, id: this.lastID });
    }
  );
};

exports.updateDocument = (req, res) => {
  const { client_id, title, category, content, visibility } = req.body;
  const normalizedVisibility = visibility || 'interno_goldtech';

  if (!client_id || !title || !content) {
    return res.status(400).json({ message: 'Cliente, titulo e conteudo sao obrigatorios.' });
  }

  if (!ALLOWED_VISIBILITIES.has(normalizedVisibility)) {
    return res.status(400).json({ message: 'Visibilidade invalida.' });
  }

  db.run(
    `UPDATE intranet_documents
     SET client_id = ?, title = ?, category = ?, content = ?, visibility = ?,
         updated_by = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      client_id,
      title.trim(),
      (category || 'Geral').trim(),
      content.trim(),
      normalizedVisibility,
      req.userId,
      req.params.id
    ],
    function (err) {
      if (err) return res.status(500).json({ message: err.message });
      if (this.changes === 0) return res.status(404).json({ message: 'Documento nao encontrado.' });
      res.json({ success: true, message: 'Documento atualizado.' });
    }
  );
};

exports.deleteDocument = (req, res) => {
  db.run('DELETE FROM intranet_documents WHERE id = ?', [req.params.id], function (err) {
    if (err) return res.status(500).json({ message: err.message });
    if (this.changes === 0) return res.status(404).json({ message: 'Documento nao encontrado.' });
    res.json({ success: true, message: 'Documento removido.' });
  });
};
