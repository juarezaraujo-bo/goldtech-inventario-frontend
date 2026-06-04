const { db } = require('../models/db');

exports.getMonitoringSummary = (req, res) => {
  // Usa MAX(created_at) + JOIN em vez de ROW_NUMBER() para compatibilidade com SQLite < 3.25
  const query = `
    SELECT
      e.id, e.nome, e.categoria, e.client_id, c.name AS client_name,
      p.cpu_usage_percent, p.memory_usage_percent, p.disk_free_percent, p.disk_free_gb,
      p.network_usage, p.created_at AS last_performance_at
    FROM equipments e
    LEFT JOIN clients c ON e.client_id = c.id
    LEFT JOIN equipment_performance p
      ON p.equipment_id = e.id
      AND p.created_at = (
        SELECT MAX(ep2.created_at)
        FROM equipment_performance ep2
        WHERE ep2.equipment_id = e.id
      )
    WHERE e.status = 'Ativo'
  `;

  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ message: err.message });

    const performanceAlerts = [];
    const monitoredOk = [];
    const noPerformanceData = [];

    let cpuAlta = 0;
    let ramAlta = 0;
    let discoCritico = 0;
    let semColeta = 0;

    const agora = Date.now();
    const limite24h = 24 * 60 * 60 * 1000; // ms

    rows.forEach(equip => {
      const temColeta = !!equip.last_performance_at;
      const coletaRecente = temColeta && (agora - new Date(equip.last_performance_at).getTime()) <= limite24h;

      if (!coletaRecente) {
        semColeta++;
        noPerformanceData.push({
          ...equip,
          status_coleta: temColeta ? 'Coleta desatualizada (> 24h)' : 'Nunca coletado',
          acao_recomendada: 'Instalar ou executar windows-performance.ps1 na máquina'
        });
        return;
      }

      const alerts = [];

      if (equip.cpu_usage_percent >= 90) {
        alerts.push({ motivo: 'CPU acima de 90%', acao: 'Verificar processos em execução' });
        cpuAlta++;
      }
      if (equip.memory_usage_percent >= 90) {
        alerts.push({ motivo: 'Memória acima de 90%', acao: 'Avaliar upgrade de RAM ou processos em excesso' });
        ramAlta++;
      }
      if (equip.disk_free_percent <= 10) {
        alerts.push({ motivo: 'Disco com menos de 10% livre', acao: 'Liberar espaço ou expandir armazenamento' });
        discoCritico++;
      }

      if (alerts.length > 0) {
        performanceAlerts.push({ ...equip, alerts });
      } else {
        monitoredOk.push(equip);
      }
    });

    res.json({
      summary: {
        total_monitorados: rows.length,
        cpu_alta: cpuAlta,
        ram_alta: ramAlta,
        disco_critico: discoCritico,
        sem_coleta: semColeta,
        alertas_ativos: performanceAlerts.length
      },
      performance_alerts: performanceAlerts,
      monitored_ok: monitoredOk,
      no_performance_data: noPerformanceData
    });
  });
};
