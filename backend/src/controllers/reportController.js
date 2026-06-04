const { db } = require('../models/db');
const { parse } = require('json2csv');
const { classifyObsolescence } = require('../utils/obsolescenceUtils');

exports.getGeneralStats = (req, res) => {
  const { client_id } = req.query;
  let where = '';
  const params = [];

  if (client_id) {
    where = 'WHERE client_id = ?';
    params.push(client_id);
  }

  const query = `
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN categoria = 'Notebooks' THEN 1 ELSE 0 END) as notebooks,
      SUM(CASE WHEN categoria = 'Desktops' THEN 1 ELSE 0 END) as desktops,
      SUM(CASE WHEN categoria = 'Servidores' THEN 1 ELSE 0 END) as servers,
      SUM(CASE WHEN categoria = 'Ativos de Rede' THEN 1 ELSE 0 END) as network,
      SUM(CASE WHEN categoria = 'Roteadores' THEN 1 ELSE 0 END) as routers,
      SUM(CASE WHEN status = 'Manutenção' THEN 1 ELSE 0 END) as maintenance,
      SUM(CASE WHEN ultima_coleta IS NULL OR ultima_coleta = '' THEN 1 ELSE 0 END) as no_collection
    FROM equipments ${where}
  `;
  
  db.get(query, params, (err, row) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json(row);
  });
};

exports.getAnalyticalReports = (req, res) => {
  const { client_id } = req.query;
  let query = `SELECT e.*, c.name as client_name FROM equipments e LEFT JOIN clients c ON e.client_id = c.id`;
  const params = [];

  if (client_id) {
    query += ' WHERE e.client_id = ?';
    params.push(client_id);
  }

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ message: err.message });

    const criticoList = [];
    const atencaoList = [];
    const windowsObsoleteList = [];
    const noCollectionList = [];
    const clientSummary = {};

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    rows.forEach(item => {
      // ── Classificação de obsolescência (nova lógica centralizada) ──
      const { status_obsolescencia, acao_recomendada, motivos } = classifyObsolescence(item);
      const enriched = {
        ...item,
        status_obsolescencia,
        acao_recomendada,
        obsolete_reason: motivos.join(', ') || 'Nenhum motivo identificado'
      };

      if (status_obsolescencia === 'critico') criticoList.push(enriched);
      else if (status_obsolescencia === 'atencao') atencaoList.push(enriched);

      // ── SO obsoleto (mantido como lista separada para compatibilidade) ──
      const os = (item.sistema_operacional || '').toLowerCase();
      if (os.includes('windows 7') || os.includes('windows 8') ||
          os.includes('server 2008') || os.includes('server 2012')) {
        windowsObsoleteList.push(enriched);
      }

      // ── Sem coleta ──
      if (!item.ultima_coleta || new Date(item.ultima_coleta) < thirtyDaysAgo) {
        noCollectionList.push(item);
      }

      // ── Resumo por cliente ──
      const key = item.client_name || 'Sem cliente';
      if (!clientSummary[key]) {
        clientSummary[key] = {
          name: key, total: 0, notebooks: 0, desktops: 0,
          servers: 0, network: 0, routers: 0, maintenance: 0,
          critico: 0, atencao: 0
        };
      }
      const s = clientSummary[key];
      s.total++;
      if (item.categoria === 'Notebooks') s.notebooks++;
      if (item.categoria === 'Desktops') s.desktops++;
      if (item.categoria === 'Servidores') s.servers++;
      if (item.categoria === 'Ativos de Rede') s.network++;
      if (item.categoria === 'Roteadores') s.routers++;
      if (item.status === 'Manutenção') s.maintenance++;
      if (status_obsolescencia === 'critico') s.critico++;
      if (status_obsolescencia === 'atencao') s.atencao++;
    });

    const categoryMap = {};
    rows.forEach(r => { categoryMap[r.categoria] = (categoryMap[r.categoria] || 0) + 1; });
    const statusMap = {};
    rows.forEach(r => { statusMap[r.status] = (statusMap[r.status] || 0) + 1; });

    res.json({
      // Lista combinada para compatibilidade retroativa (críticos + atenção)
      obsolete: [...criticoList, ...atencaoList],
      // Novas listas separadas por nível
      critico: criticoList,
      atencao: atencaoList,
      windowsObsolete: windowsObsoleteList,
      noCollection: noCollectionList,
      clientSummary: Object.values(clientSummary),
      charts: {
        byCategory: Object.entries(categoryMap).map(([name, value]) => ({ name, value })),
        byStatus: Object.entries(statusMap).map(([name, value]) => ({ name, value }))
      }
    });
  });
};

exports.exportCsv = (req, res) => {
  const { client_id } = req.query;
  let query = `SELECT e.*, c.name as client_name FROM equipments e LEFT JOIN clients c ON e.client_id = c.id`;
  const params = [];

  if (client_id) {
    query += ' WHERE e.client_id = ?';
    params.push(client_id);
  }

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ message: err.message });
    if (!rows || rows.length === 0) return res.status(200).send('');

    try {
      // Enriquecer cada linha com status de obsolescência
      const enrichedRows = rows.map(r => {
        const { status_obsolescencia, acao_recomendada } = classifyObsolescence(r);
        return { ...r, status_obsolescencia, acao_recomendada };
      });

      const fields = [
        { label: 'Cliente', value: 'client_name' },
        { label: 'Equipamento', value: 'nome' },
        { label: 'Categoria', value: 'categoria' },
        { label: 'Fabricante', value: 'fabricante' },
        { label: 'Modelo', value: 'modelo' },
        { label: 'Sistema Operacional', value: 'sistema_operacional' },
        { label: 'Processador', value: 'processador' },
        { label: 'RAM', value: 'memoria_ram' },
        { label: 'Armazenamento', value: 'armazenamento' },
        { label: 'IP', value: 'ip' },
        { label: 'MAC', value: 'mac' },
        { label: 'Status', value: 'status' },
        { label: 'Última Coleta', value: 'ultima_coleta' },
        { label: 'Status Obsolescência', value: 'status_obsolescencia' },
        { label: 'Ação Recomendada', value: 'acao_recomendada' },
        { label: 'Patrimônio', value: 'patrimonio' },
        { label: 'Número de Série', value: 'numero_serie' },
        { label: 'Localização', value: 'localizacao' },
        { label: 'Setor', value: 'setor' },
      ];
      const csv = parse(enrichedRows, { fields });
      res.header('Content-Type', 'text/csv; charset=utf-8');
      res.header('Content-Disposition', 'attachment; filename=inventario_goldtech.csv');
      res.send('\uFEFF' + csv);
    } catch (parseErr) {
      res.status(500).json({ message: 'Erro ao gerar CSV' });
    }
  });
};
