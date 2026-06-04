import { useEffect, useState } from 'react';
import { 
  X, Edit2, Move, LayoutGrid, Monitor, Laptop, Server, Router, 
  Network, Box, Activity, Clock, Shield, Cpu, HardDrive, 
  ChevronRight, Check, AlertCircle, AlertTriangle, CheckCircle
} from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { classifyObsolescence, getObsolescenceBadge } from '../utils/obsolescenceUtils';

export default function AssetDetailsModal({ asset, onClose, onUpdate, initialView = 'details' }) {
  const [view, setView] = useState(initialView);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [performance, setPerformance] = useState(null);

  useEffect(() => {
    if (asset) setView(initialView);
  }, [asset, initialView]);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        if (view !== 'details') {
          setView('details');
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [view, onClose]);

  useEffect(() => {
    if (view === 'move') {
      const fetchClients = async () => {
        try {
          const { data } = await api.get('/clients');
          setClients(data);
        } catch (err) {
          toast.error('Erro ao carregar clientes');
        }
      };
      fetchClients();
    }
  }, [view]);

  useEffect(() => {
    if (asset && view === 'details') {
      const fetchPerformance = async () => {
        try {
          const { data } = await api.get(`/equipments/${asset.id}/performance`);
          if (data && !data.message) {
            setPerformance(data);
          } else {
            setPerformance(null);
          }
        } catch (err) {
          console.error("Erro ao carregar performance:", err);
        }
      };
      fetchPerformance();
    }
  }, [asset, view]);

  if (!asset) return null;

  const handleMoveConfirm = async (clientId) => {
    setLoading(true);
    const payload = { client_id: Number(clientId) };
    const url = `/equipments/${asset.id}/move`;

    console.log("DEBUG MOVE:", { url, payload });

    try {
      const response = await api.patch(url, payload);
      
      if (response.data.success) {
        toast.success('Equipamento movido com sucesso');
        onUpdate();
        onClose();
      } else {
        toast.error(response.data.message || 'Erro ao mover cliente');
      }
    } catch (err) {
      console.error("ERRO MOVIMENTAÇÃO:", {
        url,
        payload,
        status: err.response?.status,
        data: err.response?.data
      });
      
      const errorMessage = err.response?.data?.message || err.response?.data?.error || 'Erro na comunicação com o servidor';
      toast.error(`Falha: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryConfirm = async (newCat) => {
    setLoading(true);
    const payload = { categoria: newCat };
    const url = `/equipments/${asset.id}/category`;

    console.log("DEBUG CATEGORY:", { url, payload });

    try {
      const response = await api.patch(url, payload);
      if (response.data.success) {
        toast.success('Categoria atualizada');
        onUpdate();
        onClose();
      }
    } catch (err) {
      console.error("ERRO CATEGORIA:", {
        url,
        payload,
        status: err.response?.status,
        data: err.response?.data
      });
      const msg = err.response?.data?.message || err.response?.data?.error || 'Erro ao atualizar categoria';
      toast.error(`Falha: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (cat) => {
    switch (cat) {
      case 'Notebooks': return <Laptop size={24} />;
      case 'Servidores': return <Server size={24} />;
      case 'Roteadores': return <Router size={24} />;
      case 'Ativos de Rede': return <Network size={24} />;
      default: return <Monitor size={24} />;
    }
  };

  return (
    <div 
      className="animate-fade" 
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="glass-panel animate-scale" style={{ width: '100%', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto', padding: 0, borderRadius: '24px', border: '1px solid var(--border-glass)' }}>
        
        {/* Header Modal */}
        <div style={{ padding: '1.5rem 2.5rem', borderBottom: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', sticky: 'top', top: 0, zIndex: 5 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div style={{ padding: '10px', background: 'rgba(212, 175, 55, 0.1)', borderRadius: '12px', color: 'var(--primary-gold)' }}>
              {getIcon(asset.categoria)}
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', margin: 0 }}>{asset.nome}</h2>
              <p style={{ color: 'var(--text-light)', fontWeight: 600, fontSize: '0.85rem', margin: 0 }}>{asset.client_name} • {asset.categoria}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--text-light)', cursor: 'pointer', padding: '10px', borderRadius: '50%' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '2.5rem' }}>
          {view === 'details' && (
            <div className="animate-fade">
              {/* Detalhes omitidos para brevidade, mas mantidos no arquivo real */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Colunas de Identificação, Especificações e Rede mantidas conforme versão anterior */}
                <div className="content-stack">
                  <h3 style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary-gold)', letterSpacing: '1px', marginBottom: '0.5rem' }}>Identificação</h3>
                  <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', background: 'rgba(0,0,0,0.2)' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.6rem', color: 'var(--text-light)', marginBottom: '4px' }}>Patrimônio</label>
                      <span style={{ color: '#fff', fontWeight: 700 }}>{asset.patrimonio || 'N/A'}</span>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.6rem', color: 'var(--text-light)', marginBottom: '4px' }}>Número de Série</label>
                      <span style={{ color: '#fff', fontWeight: 700 }}>{asset.numero_serie || 'N/A'}</span>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.6rem', color: 'var(--text-light)', marginBottom: '4px' }}>Fabricante / Modelo</label>
                      <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.8rem' }}>{asset.fabricante} {asset.modelo}</span>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.6rem', color: 'var(--text-light)', marginBottom: '4px' }}>Status</label>
                      <span className={`status-badge ${asset.status === 'Ativo' ? 'status-active' : 'status-retired'}`}>{asset.status}</span>
                    </div>
                  </div>
                </div>

                <div className="content-stack">
                  <h3 style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--accent-blue)', letterSpacing: '1px', marginBottom: '0.5rem' }}>Especificações</h3>
                  <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', background: 'rgba(0,0,0,0.2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Cpu size={14} color="var(--text-light)" />
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '0.6rem', color: 'var(--text-light)' }}>Processador</label>
                        <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.75rem', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{asset.processador || 'N/A'}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Activity size={14} color="var(--text-light)" />
                      <div>
                        <label style={{ display: 'block', fontSize: '0.6rem', color: 'var(--text-light)' }}>Memória RAM</label>
                        <span style={{ color: '#fff', fontWeight: 700 }}>{asset.memoria_ram || 'N/A'}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <HardDrive size={14} color="var(--text-light)" />
                      <div>
                        <label style={{ display: 'block', fontSize: '0.6rem', color: 'var(--text-light)' }}>Armazenamento</label>
                        <span style={{ color: '#fff', fontWeight: 700 }}>{asset.armazenamento || 'N/A'}</span>
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.6rem', color: 'var(--text-light)', marginBottom: '4px' }}>Sistema Operacional</label>
                      <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.75rem' }}>{asset.sistema_operacional}</span>
                    </div>
                  </div>
                </div>

                <div className="content-stack">
                  <h3 style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--accent-emerald)', letterSpacing: '1px', marginBottom: '0.5rem' }}>Rede e Auditoria</h3>
                  <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', background: 'rgba(0,0,0,0.2)' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.6rem', color: 'var(--text-light)', marginBottom: '4px' }}>Endereço IP</label>
                      <span style={{ color: 'var(--accent-blue)', fontWeight: 700, fontSize: '0.8rem' }}>{asset.ip || '0.0.0.0'}</span>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.6rem', color: 'var(--text-light)', marginBottom: '4px' }}>Endereço MAC</label>
                      <span style={{ color: 'var(--text-light)', fontWeight: 700, fontSize: '0.7rem' }}>{asset.mac || 'N/A'}</span>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.6rem', color: 'var(--text-light)', marginBottom: '4px' }}>Última Sincronização</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={12} color="var(--text-light)" />
                        <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.75rem' }}>{asset.ultima_coleta ? new Date(asset.ultima_coleta).toLocaleString() : 'Sem registros'}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-emerald)', background: 'rgba(16, 185, 129, 0.05)', padding: '10px', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.1)' }}>
                      <Shield size={14} />
                      <span style={{ fontSize: '0.65rem', fontWeight: 800 }}>{asset.antivirus || 'Nenhum AV Detectado'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Seção de Desempenho em Tempo Real */}
              <div style={{ marginTop: '2rem', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                <div className="glass-panel" style={{ padding: '1rem', textAlign: 'center', border: (performance?.cpu_usage_percent > 90) ? '1px solid #ef4444' : '1px solid var(--border-glass)' }}>
                  <div style={{ fontSize: '0.6rem', color: 'var(--text-light)', textTransform: 'uppercase', marginBottom: '5px' }}>CPU</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: (performance?.cpu_usage_percent > 90) ? '#ef4444' : '#fff' }}>
                    {performance ? `${performance.cpu_usage_percent}%` : '--'}
                  </div>
                  {performance?.cpu_usage_percent > 90 && <div style={{ fontSize: '0.55rem', color: '#ef4444', fontWeight: 700 }}>SOBRECARGA</div>}
                </div>
                <div className="glass-panel" style={{ padding: '1rem', textAlign: 'center', border: (performance?.memory_usage_percent > 90) ? '1px solid #ef4444' : '1px solid var(--border-glass)' }}>
                  <div style={{ fontSize: '0.6rem', color: 'var(--text-light)', textTransform: 'uppercase', marginBottom: '5px' }}>Memória</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: (performance?.memory_usage_percent > 90) ? '#ef4444' : '#fff' }}>
                    {performance ? `${performance.memory_usage_percent}%` : '--'}
                  </div>
                  {performance?.memory_usage_percent > 90 && <div style={{ fontSize: '0.55rem', color: '#ef4444', fontWeight: 700 }}>LIMITE</div>}
                </div>
                <div className="glass-panel" style={{ padding: '1rem', textAlign: 'center', border: (performance?.disk_free_percent < 10) ? '1px solid #ef4444' : '1px solid var(--border-glass)' }}>
                  <div style={{ fontSize: '0.6rem', color: 'var(--text-light)', textTransform: 'uppercase', marginBottom: '5px' }}>Disco (C:) Livre</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: (performance?.disk_free_percent < 10) ? '#ef4444' : '#fff' }}>
                    {performance ? `${performance.disk_free_gb}GB` : '--'}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-light)' }}>{performance ? `${performance.disk_free_percent}%` : ''}</div>
                </div>
                <div className="glass-panel" style={{ padding: '1rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.6rem', color: 'var(--text-light)', textTransform: 'uppercase', marginBottom: '5px' }}>Rede</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#fff', marginTop: '4px' }}>
                    {performance ? performance.network_usage : '--'}
                  </div>
                  <div style={{ fontSize: '0.55rem', color: 'var(--text-light)', marginTop: '4px' }}>{performance ? new Date(performance.created_at).toLocaleTimeString() : 'Aguardando coleta...'}</div>
                </div>
              </div>

              {/* Diagnóstico de Obsolescência */}

              {(() => {
                const obs = classifyObsolescence(asset);
                const badge = getObsolescenceBadge(obs.status_obsolescencia);
                const IconMap = { critico: AlertTriangle, atencao: AlertCircle, normal: CheckCircle };
                const Icon = IconMap[obs.status_obsolescencia] || CheckCircle;
                return (
                  <div style={{ marginTop: '2rem', padding: '1.75rem', borderRadius: '16px', background: badge.bg, border: `1px solid ${badge.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Icon size={20} color={badge.color} />
                        <span style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: badge.color }}>Diagnóstico de Obsolescência</span>
                      </div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 900, padding: '4px 12px', borderRadius: '8px', background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`, letterSpacing: '1px' }}>
                        {badge.label}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '1rem' }}>
                      <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px 14px', borderRadius: '10px' }}>
                        <div style={{ fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', letterSpacing: '1px', marginBottom: '4px' }}>Ano Estimado CPU</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fff' }}>{obs.cpu_estimated_year}</div>
                        {obs.cpu_generation && <div style={{ fontSize: '0.65rem', color: badge.color, fontWeight: 700, marginTop: '2px' }}>{obs.cpu_generation}ª geração Intel</div>}
                      </div>
                      <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px 14px', borderRadius: '10px' }}>
                        <div style={{ fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', letterSpacing: '1px', marginBottom: '4px' }}>Ano Aprox. Placa-Mãe</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fff' }}>{obs.bios_year}</div>
                        {asset.placa_mae && <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600, marginTop: '2px' }}>{asset.placa_mae}</div>}
                      </div>
                    </div>
                    {obs.motivos.length > 0 && (
                      <div style={{ marginBottom: '1rem' }}>
                        <div style={{ fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', letterSpacing: '1px', marginBottom: '8px' }}>Motivos Identificados</div>
                        <ul style={{ margin: 0, padding: '0 0 0 1.25rem', listStyle: 'disc' }}>
                          {obs.motivos.map((m, i) => (
                            <li key={i} style={{ fontSize: '0.78rem', color: badge.color, opacity: 0.9, lineHeight: 1.7, marginBottom: '4px' }}>{m}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px' }}>Ação Recomendada:</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fff' }}>{obs.acao_recomendada}</span>
                    </div>
                  </div>
                );
              })()}

              {/* Footer Actions */}
              <div style={{ marginTop: '3rem', paddingTop: '2rem', borderTop: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button onClick={() => setView('move')} className="btn-outline-premium" style={{ color: 'var(--primary-gold)', borderColor: 'var(--primary-gold)' }}>
                    <Move size={18} /> Mover Cliente
                  </button>
                  <button onClick={() => setView('category')} className="btn-outline-premium">
                    <LayoutGrid size={18} /> Alterar Categoria
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button onClick={() => window.location.href = `/editar/${asset.id}`} className="btn-premium">
                    <Edit2 size={18} /> Editar Ativo
                  </button>
                </div>
              </div>
            </div>
          )}

          {view === 'move' && (
            <div className="animate-fade">
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', marginBottom: '0.5rem' }}>Mover para Cliente</h3>
                <p style={{ color: 'var(--text-light)', fontSize: '0.9rem' }}>Selecione o novo cliente para alocação do ativo <strong>{asset.nome}</strong>.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ maxHeight: '300px', overflowY: 'auto', paddingRight: '10px' }}>
                {clients.map(c => (
                  <div 
                    key={c.id} 
                    onClick={() => handleMoveConfirm(c.id)}
                    className="glass-panel" 
                    style={{ 
                      padding: '1.25rem', 
                      cursor: 'pointer', 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      border: c.id === asset.client_id ? '2px solid var(--primary-gold)' : '1px solid var(--border-glass)',
                      background: c.id === asset.client_id ? 'rgba(212, 175, 55, 0.05)' : 'rgba(255,255,255,0.02)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ fontWeight: 700, color: '#fff' }}>{c.name}</div>
                    {c.id === asset.client_id ? <Check size={18} color="var(--primary-gold)" /> : <ChevronRight size={18} color="var(--text-light)" />}
                  </div>
                ))}
              </div>

              <div style={{ marginTop: '2.5rem', display: 'flex', gap: '12px' }}>
                <button onClick={() => setView('details')} className="btn-outline-premium" style={{ flex: 1 }}>Cancelar</button>
              </div>
            </div>
          )}

          {view === 'category' && (
            <div className="animate-fade">
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', marginBottom: '0.5rem' }}>Alterar Categoria</h3>
                <p style={{ color: 'var(--text-light)', fontSize: '0.9rem' }}>Selecione a nova classificação técnica para este ativo.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {['Desktops', 'Notebooks', 'Servidores', 'Roteadores', 'Ativos de Rede', 'Outros'].map(cat => (
                  <div 
                    key={cat} 
                    onClick={() => handleCategoryConfirm(cat)}
                    className="glass-panel" 
                    style={{ 
                      padding: '1.5rem', 
                      cursor: 'pointer', 
                      textAlign: 'center',
                      border: cat === asset.categoria ? '2px solid var(--primary-gold)' : '1px solid var(--border-glass)',
                      background: cat === asset.categoria ? 'rgba(212, 175, 55, 0.05)' : 'rgba(255,255,255,0.02)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ fontWeight: 800, color: '#fff' }}>{cat}</div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: '2.5rem', display: 'flex', gap: '12px' }}>
                <button onClick={() => setView('details')} className="btn-outline-premium" style={{ flex: 1 }}>Cancelar</button>
              </div>
            </div>
          )}
        </div>

        {loading && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '24px' }}>
            <Activity className="animate-spin" color="var(--primary-gold)" size={40} />
          </div>
        )}

      </div>
    </div>
  );
}
