import { useEffect, useState } from 'react';
import { 
  Activity, AlertTriangle, AlertCircle, Monitor, Server, 
  Cpu, HardDrive, Filter, Download, ExternalLink, Clock,
  Search, CheckCircle, Info
} from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import AssetDetailsModal from '../components/AssetDetailsModal';

export default function Reports() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');

  const fetchMonitoringData = async () => {
    setLoading(true);
    try {
      const response = await api.get('/monitoring/summary');
      setData(response.data);
    } catch (err) {
      toast.error('Erro ao carregar dados de monitoramento');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonitoringData();
    const fetchClients = async () => {
      const { data } = await api.get('/clients');
      setClients(data);
    };
    fetchClients();
  }, []);

  const matchesFilters = (item) => {
    const matchesClient = !selectedClientId || item.client_id === Number(selectedClientId);
    const matchesSearch = !searchTerm || item.nome.toLowerCase().includes(searchTerm.toLowerCase()) || item.client_name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesClient && matchesSearch;
  };

  const filteredPerformanceAlerts = data?.performance_alerts?.filter(alert => {
    if (!matchesFilters(alert)) return false;
    if (filterType === 'all') return true;
    if (filterType === 'cpu') return alert.alerts.some(a => a.motivo.includes('CPU'));
    if (filterType === 'ram') return alert.alerts.some(a => a.motivo.includes('Memória'));
    if (filterType === 'disk') return alert.alerts.some(a => a.motivo.includes('Disco'));
    return true;
  }) || [];

  const filteredMonitoredOk = data?.monitored_ok?.filter(item => {
    if (!matchesFilters(item)) return false;
    if (filterType === 'all' || filterType === 'ok') return true;
    return false;
  }) || [];

  const filteredNoCollection = data?.no_performance_data?.filter(item => {
    if (!matchesFilters(item)) return false;
    if (filterType === 'all' || filterType === 'no_collection') return true;
    return false;
  }) || [];

  const exportToCsv = () => {
    const escape = (v) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const headers = ['Cliente', 'Equipamento', 'Categoria', 'CPU (%)', 'RAM (%)', 'Disco Livre (%)', 'Disco Livre (GB)', 'Última Coleta', 'Status', 'Motivo', 'Ação Recomendada'];

    const alertRows = filteredPerformanceAlerts.map(item => [
      escape(item.client_name),
      escape(item.nome),
      escape(item.categoria),
      escape(item.cpu_usage_percent),
      escape(item.memory_usage_percent),
      escape(item.disk_free_percent),
      escape(item.disk_free_gb),
      escape(item.last_performance_at ? new Date(item.last_performance_at).toLocaleString() : ''),
      'Alerta',
      escape(item.alerts?.map(a => a.motivo).join(' | ')),
      escape(item.alerts?.map(a => a.acao).join(' | ')),
    ].join(','));

    const okRows = filteredMonitoredOk.map(item => [
      escape(item.client_name),
      escape(item.nome),
      escape(item.categoria),
      escape(item.cpu_usage_percent),
      escape(item.memory_usage_percent),
      escape(item.disk_free_percent),
      escape(item.disk_free_gb),
      escape(item.last_performance_at ? new Date(item.last_performance_at).toLocaleString() : ''),
      'OK',
      '',
      '',
    ].join(','));

    const noColRows = filteredNoCollection.map(item => [
      escape(item.client_name),
      escape(item.nome),
      escape(item.categoria),
      '',
      '',
      '',
      '',
      escape(item.last_performance_at ? new Date(item.last_performance_at).toLocaleString() : 'Nunca coletado'),
      escape(item.status_coleta),
      '',
      escape(item.acao_recomendada),
    ].join(','));

    const csvContent = [headers.join(','), ...alertRows, ...okRows, ...noColRows].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `monitoramento_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Relatório exportado com sucesso!');
  };

  if (loading && !data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <Activity className="animate-spin" color="var(--primary-gold)" size={48} />
      </div>
    );
  }

  return (
    <div className="animate-fade">
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 900, color: '#fff', marginBottom: '0.5rem', letterSpacing: '-1px' }}>
            Monitoramento <span style={{ color: 'var(--primary-gold)' }}>Analítico</span>
          </h1>
          <p style={{ color: 'var(--text-light)', fontWeight: 600 }}>Gestão de performance e saúde dos ativos de TI.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={fetchMonitoringData} className="btn-outline-premium">
            <Activity size={18} /> Atualizar
          </button>
          <button className="btn-premium" onClick={exportToCsv}>
            <Download size={18} /> Exportar Relatório
          </button>
        </div>
      </div>

      {/* Alerta de Configuração do Agente */}
      <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', marginBottom: '2.5rem', borderLeft: '4px solid var(--primary-gold)', background: 'rgba(212,175,55,0.05)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Info size={24} color="var(--primary-gold)" />
        <p style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 600, margin: 0 }}>
          Para exibir uso de CPU, RAM, disco e rede, o script <code style={{ color: 'var(--primary-gold)', background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '4px' }}>windows-performance.ps1</code> precisa estar rodando nas máquinas e enviando dados para o endpoint <code style={{ opacity: 0.8 }}>/api/agent/performance</code>.
        </p>
      </div>

      {/* KPI Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '1.25rem', marginBottom: '2.5rem' }}>
        <div className="report-kpi-card" style={{ borderLeft: '4px solid #fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '1rem' }}>
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '10px', color: '#fff' }}><Monitor size={20} /></div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#fff' }}>{data?.summary?.total_monitorados || 0}</div>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-light)', letterSpacing: '1px' }}>Total Monitorados</div>
        </div>

        <div className="report-kpi-card" style={{ borderLeft: '4px solid #ef4444' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '1rem' }}>
            <div style={{ background: 'rgba(239,68,68,0.1)', padding: '8px', borderRadius: '10px', color: '#ef4444' }}><Cpu size={20} /></div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#fff' }}>{data?.summary?.cpu_alta || 0}</div>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-light)', letterSpacing: '1px' }}>CPU {'>'} 90%</div>
        </div>

        <div className="report-kpi-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '1rem' }}>
            <div style={{ background: 'rgba(245,158,11,0.1)', padding: '8px', borderRadius: '10px', color: '#f59e0b' }}><Activity size={20} /></div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#fff' }}>{data?.summary?.ram_alta || 0}</div>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-light)', letterSpacing: '1px' }}>RAM {'>'} 90%</div>
        </div>

        <div className="report-kpi-card" style={{ borderLeft: '4px solid #ef4444' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '1rem' }}>
            <div style={{ background: 'rgba(239,68,68,0.1)', padding: '8px', borderRadius: '10px', color: '#ef4444' }}><HardDrive size={20} /></div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#fff' }}>{data?.summary?.disco_critico || 0}</div>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-light)', letterSpacing: '1px' }}>Disco {'>'} 90%</div>
        </div>

        <div className="report-kpi-card" style={{ borderLeft: '4px solid #94a3b8' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '1rem' }}>
            <div style={{ background: 'rgba(148,163,184,0.1)', padding: '8px', borderRadius: '10px', color: '#94a3b8' }}><Clock size={20} /></div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#fff' }}>{data?.summary?.sem_coleta || 0}</div>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-light)', letterSpacing: '1px' }}>Sem Coleta</div>
        </div>

        <div className="report-kpi-card" style={{ borderLeft: '4px solid var(--accent-emerald)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '1rem' }}>
            <div style={{ background: 'rgba(16,185,129,0.1)', padding: '8px', borderRadius: '10px', color: 'var(--accent-emerald)' }}><AlertTriangle size={20} /></div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#fff' }}>{data?.summary?.alertas_ativos || 0}</div>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-light)', letterSpacing: '1px' }}>Alertas de Uso</div>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
          <input 
            type="text" 
            placeholder="Buscar equipamento..." 
            className="form-control-premium"
            style={{ paddingLeft: '48px', height: '48px' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div style={{ display: 'flex', gap: '1rem', width: '450px' }}>
          <select 
            className="form-control-premium" 
            style={{ height: '48px', flex: 1 }}
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
          >
            <option value="">Todos os Clientes</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select 
            className="form-control-premium" 
            style={{ height: '48px', flex: 1 }}
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="all">Todos os Tipos</option>
            <option value="cpu">CPU Alta</option>
            <option value="ram">RAM Alta</option>
            <option value="disk">Disco Crítico</option>
            <option value="ok">Monitorados OK</option>
            <option value="no_collection">Sem Coleta</option>
          </select>
        </div>
      </div>

      {/* TABELA A: Equipamentos com uso acima do ideal */}
      {(filterType === 'all' || ['cpu', 'ram', 'disk'].includes(filterType)) && (
        <div className="glass-panel section-spacing" style={{ padding: '2rem', borderLeft: '4px solid #ef4444', marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
            <Activity size={22} color="#ef4444" />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', margin: 0 }}>Equipamentos com uso acima do ideal</h3>
            <span style={{ marginLeft: 'auto', fontSize: '0.75rem', fontWeight: 900, padding: '4px 14px', borderRadius: '8px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
              {filteredPerformanceAlerts.length} ativo(s)
            </span>
          </div>

          <table className="table-enterprise">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Equipamento</th>
                <th>CPU / RAM</th>
                <th>Disco Livre</th>
                <th>Última Coleta</th>
                <th>Motivo / Ação Recomendada</th>
              </tr>
            </thead>
            <tbody>
              {filteredPerformanceAlerts.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-light)', fontWeight: 600 }}>
                    Nenhum equipamento com uso acima do ideal.
                  </td>
                </tr>
              ) : (
                filteredPerformanceAlerts.map((alert, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 700 }}>{alert.client_name}</td>
                    <td>
                      <div 
                        onClick={() => setSelectedAsset(alert)}
                        style={{ color: 'var(--primary-gold)', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        {alert.nome} <ExternalLink size={12} opacity={0.5} />
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>{alert.categoria}</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800, background: alert.cpu_usage_percent >= 90 ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.05)', color: alert.cpu_usage_percent >= 90 ? '#ef4444' : '#fff' }}>
                          CPU: {alert.cpu_usage_percent}%
                        </span>
                        <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800, background: alert.memory_usage_percent >= 90 ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.05)', color: alert.memory_usage_percent >= 90 ? '#ef4444' : '#fff' }}>
                          RAM: {alert.memory_usage_percent}%
                        </span>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: alert.disk_free_percent <= 10 ? '#ef4444' : '#fff' }}>
                        {alert.disk_free_percent}% ({alert.disk_free_gb}GB)
                      </div>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>{new Date(alert.last_performance_at).toLocaleString()}</td>
                    <td>
                      {alert.alerts.map((a, idx) => (
                        <div key={idx} style={{ marginBottom: '4px' }}>
                          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#ef4444' }}>• {a.motivo}</div>
                          <div style={{ fontSize: '0.7rem', color: '#fff', opacity: 0.8 }}>→ {a.acao}</div>
                        </div>
                      ))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TABELA B: Equipamentos monitorados (sem alerta) */}
      {(filterType === 'all' || filterType === 'ok') && (
        <div className="glass-panel section-spacing" style={{ padding: '2rem', borderLeft: '4px solid var(--accent-emerald)', marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
            <CheckCircle size={22} color="var(--accent-emerald)" />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', margin: 0 }}>Equipamentos monitorados</h3>
            <span style={{ marginLeft: 'auto', fontSize: '0.75rem', fontWeight: 900, padding: '4px 14px', borderRadius: '8px', background: 'rgba(16,185,129,0.15)', color: 'var(--accent-emerald)', border: '1px solid rgba(16,185,129,0.3)' }}>
              {filteredMonitoredOk.length} ativo(s)
            </span>
          </div>

          <table className="table-enterprise">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Equipamento</th>
                <th>CPU / RAM</th>
                <th>Disco Livre</th>
                <th>Última Coleta</th>
              </tr>
            </thead>
            <tbody>
              {filteredMonitoredOk.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-light)', fontWeight: 600 }}>
                    Nenhum equipamento monitorado sem alertas.
                  </td>
                </tr>
              ) : (
                filteredMonitoredOk.map((item, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 700 }}>{item.client_name}</td>
                    <td>
                      <div
                        onClick={() => setSelectedAsset(item)}
                        style={{ color: 'var(--primary-gold)', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        {item.nome} <ExternalLink size={12} opacity={0.5} />
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>{item.categoria}</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800, background: 'rgba(16,185,129,0.1)', color: 'var(--accent-emerald)' }}>
                          CPU: {item.cpu_usage_percent}%
                        </span>
                        <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800, background: 'rgba(16,185,129,0.1)', color: 'var(--accent-emerald)' }}>
                          RAM: {item.memory_usage_percent}%
                        </span>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-emerald)' }}>
                        {item.disk_free_percent}% ({item.disk_free_gb}GB)
                      </div>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>{new Date(item.last_performance_at).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TABELA C: Sem coleta */}
      {(filterType === 'all' || filterType === 'no_collection') && (
        <div className="glass-panel section-spacing" style={{ padding: '2rem', borderLeft: '4px solid #94a3b8' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
            <Clock size={22} color="#94a3b8" />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', margin: 0 }}>Sem coleta</h3>
            <span style={{ marginLeft: 'auto', fontSize: '0.75rem', fontWeight: 900, padding: '4px 14px', borderRadius: '8px', background: 'rgba(148,163,184,0.15)', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.3)' }}>
              {filteredNoCollection.length} ativo(s)
            </span>
          </div>

          <table className="table-enterprise">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Equipamento</th>
                <th>Última Coleta</th>
                <th>Status</th>
                <th>Ação Recomendada</th>
              </tr>
            </thead>
            <tbody>
              {filteredNoCollection.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-light)', fontWeight: 600 }}>
                    Todos os equipamentos estão enviando dados normalmente.
                  </td>
                </tr>
              ) : (
                filteredNoCollection.map((item, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 700 }}>{item.client_name}</td>
                    <td>
                      <div 
                        onClick={() => setSelectedAsset(item)}
                        style={{ color: '#fff', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        {item.nome} <ExternalLink size={12} opacity={0.5} />
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>{item.categoria}</div>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>
                      {item.last_performance_at ? new Date(item.last_performance_at).toLocaleString() : 'Nunca coletado'}
                    </td>
                    <td>
                      <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: '#94a3b8', background: 'rgba(148,163,184,0.1)', padding: '4px 10px', borderRadius: '6px' }}>
                        {item.status_coleta}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--primary-gold)', fontWeight: 600 }}>{item.acao_recomendada}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {selectedAsset && (
        <AssetDetailsModal 
          asset={selectedAsset} 
          onClose={() => setSelectedAsset(null)} 
          onUpdate={fetchMonitoringData}
        />
      )}
    </div>
  );
}
