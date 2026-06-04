const { db } = require('../models/db');
const { parse } = require('json2csv');

exports.getAll = (req, res) => {
  const { search, status, client_id, categoria } = req.query;
  let query = `
    SELECT e.*, c.name as client_name 
    FROM equipments e 
    LEFT JOIN clients c ON e.client_id = c.id 
    WHERE 1=1
  `;
  const params = [];

  if (search) {
    query += " AND (e.nome LIKE ? OR e.patrimonio LIKE ? OR e.numero_serie LIKE ? OR e.ip LIKE ?)";
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (status) {
    query += " AND e.status = ?";
    params.push(status);
  }

  if (client_id) {
    query += " AND e.client_id = ?";
    params.push(client_id);
  }

  if (categoria) {
    query += " AND e.categoria = ?";
    params.push(categoria);
  }

  query += " ORDER BY e.id DESC";

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json(rows);
  });
};

exports.getById = (req, res) => {
  const { id } = req.params;
  db.get(`
    SELECT e.*, c.name as client_name 
    FROM equipments e 
    LEFT JOIN clients c ON e.client_id = c.id 
    WHERE e.id = ?
  `, [id], (err, row) => {
    if (err) return res.status(500).json({ message: err.message });
    if (!row) return res.status(404).json({ message: "Equipamento não encontrado" });
    res.json(row);
  });
};

exports.create = (req, res) => {
  const fields = [
    'client_id', 'nome', 'categoria', 'tipo', 'fabricante', 'modelo', 'numero_serie', 
    'patrimonio', 'usuario_responsavel', 'localizacao', 'setor', 'status', 
    'data_aquisicao', 'garantia', 'observacoes', 'sistema_operacional', 
    'processador', 'memoria_ram', 'armazenamento', 'ip', 'mac', 'dominio', 
    'antivirus', 'ultima_coleta', 'origem_cadastro'
  ];
  
  const placeholders = fields.map(() => '?').join(', ');
  const values = fields.map(f => req.body[f]);

  const query = `INSERT INTO equipments (${fields.join(', ')}) VALUES (${placeholders})`;

  db.run(query, values, function(err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ message: "Já existe um equipamento com este patrimônio." });
      }
      return res.status(500).json({ message: err.message });
    }
    res.status(201).json({ success: true, id: this.lastID, ...req.body });
  });
};

exports.update = (req, res) => {
  const { id } = req.params;
  const fields = [
    'client_id', 'nome', 'categoria', 'tipo', 'fabricante', 'modelo', 'numero_serie', 
    'patrimonio', 'usuario_responsavel', 'localizacao', 'setor', 'status', 
    'data_aquisicao', 'garantia', 'observacoes', 'sistema_operacional', 
    'processador', 'memoria_ram', 'armazenamento', 'ip', 'mac', 'dominio', 
    'antivirus', 'ultima_coleta', 'origem_cadastro'
  ];

  let finalFields = [...fields];
  let finalValues = fields.map(f => req.body[f]);

  if (req.body.categoria !== undefined) {
    finalFields.push('categoria_manual');
    finalValues.push(1);
  }

  const setClause = finalFields.map(f => `${f} = ?`).join(', ');
  finalValues.push(id);

  const query = `UPDATE equipments SET ${setClause} WHERE id = ?`;

  db.run(query, finalValues, function(err) {
    if (err) return res.status(500).json({ message: err.message });
    res.json({ success: true, message: "Equipamento atualizado" });
  });
};

exports.move = (req, res) => {
  const { id } = req.params;
  // Aceitar tanto client_id quanto cliente_id para compatibilidade
  const clientId = req.body.client_id || req.body.cliente_id;
  
  if (!clientId) {
    return res.status(400).json({ 
      success: false, 
      error: "client_id é obrigatório" 
    });
  }

  // Verificar se o equipamento existe
  db.get("SELECT id FROM equipments WHERE id = ?", [id], (err, equip) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    if (!equip) return res.status(404).json({ success: false, error: "Equipamento não encontrado" });

    // Verificar se o cliente existe
    db.get("SELECT id FROM clients WHERE id = ?", [clientId], (err, client) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      if (!client) return res.status(404).json({ success: false, error: "Cliente não encontrado" });

      // Executar a movimentação
      db.run("UPDATE equipments SET client_id = ? WHERE id = ?", [clientId, id], function(err) {
        if (err) {
          console.error("MOVE ERROR SQL:", err.message);
          return res.status(500).json({ success: false, error: `Erro no banco: ${err.message}` });
        }
        
        res.json({ 
          success: true, 
          message: "Equipamento movido com sucesso",
          equipment_id: Number(id),
          client_id: Number(clientId)
        });
      });
    });
  });
};

exports.updateCategory = (req, res) => {
  const { id } = req.params;
  // Aceitar tanto 'categoria' quanto 'category'
  const categoria = req.body.categoria || req.body.category;

  console.log(`[CATEGORY] equipment=${id} categoria=${categoria} body=`, req.body);

  if (!categoria) {
    return res.status(400).json({ success: false, error: 'Categoria é obrigatória' });
  }

  db.run('UPDATE equipments SET categoria = ?, categoria_manual = 1 WHERE id = ?', [categoria, id], function(err) {
    if (err) {
      console.error('[CATEGORY] SQL error:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
    console.log(`[CATEGORY] OK: equipment ${id} → ${categoria}`);
    res.json({ success: true, message: 'Categoria atualizada com sucesso' });
  });
};

exports.delete = (req, res) => {
  const { id } = req.params;
  db.run("UPDATE equipments SET status = ? WHERE id = ?", ['Desativado', id], function(err) {
    if (err) return res.status(500).json({ success: false, message: err.message });
    if (this.changes === 0) return res.status(404).json({ success: false, message: 'Equipamento nao encontrado' });
    res.json({
      success: true,
      message: "Equipamento desativado com sucesso. O registro foi preservado no historico.",
      status: 'Desativado'
    });
  });
};

exports.getStats = (req, res) => {
  const query = `
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'Ativo' THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN status = 'Manutenção' THEN 1 ELSE 0 END) as maintenance,
      SUM(CASE WHEN status = 'Desativado' THEN 1 ELSE 0 END) as retired
    FROM equipments
  `;
  db.get(query, [], (err, row) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json(row);
  });
};

exports.getMaintenance = (req, res) => {
  const { id } = req.params;
  db.all("SELECT * FROM maintenance WHERE equipment_id = ? ORDER BY date DESC", [id], (err, rows) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json(rows);
  });
};

exports.addMaintenance = (req, res) => {
  const { id } = req.params;
  const { date, type, description, technician, cost } = req.body;
  db.run(
    "INSERT INTO maintenance (equipment_id, date, type, description, technician, cost) VALUES (?, ?, ?, ?, ?, ?)",
    [id, date, type, description, technician, cost],
    function(err) {
      if (err) return res.status(500).json({ message: err.message });
      res.status(201).json({ success: true, id: this.lastID, equipment_id: id, ...req.body });
    }
  );
};

exports.getPerformance = (req, res) => {
  const { id } = req.params;
  db.get("SELECT * FROM equipment_performance WHERE equipment_id = ? ORDER BY created_at DESC LIMIT 1", [id], (err, row) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json(row || { message: "Sem dados de performance recentes" });
  });
};

exports.exportCsv = (req, res) => {

  db.all("SELECT * FROM equipments", [], (err, rows) => {
    if (err) return res.status(500).json({ message: err.message });
    try {
      const csv = parse(rows);
      res.header('Content-Type', 'text/csv');
      res.attachment('inventario_goldtech.csv');
      res.send(csv);
    } catch (err) {
      res.status(500).json({ message: "Erro ao gerar CSV" });
    }
  });
};
