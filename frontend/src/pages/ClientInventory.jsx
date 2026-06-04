import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { API_URL } from '../services/api';
import { 
  Package, Search, Plus, Download, Edit2, Trash2, 
  ChevronLeft, LayoutGrid, Monitor, Laptop, Server, Router, 
  Network, Box, Activity, Clock, AlertTriangle, ExternalLink, ShieldCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import AssetDetailsModal from '../components/AssetDetailsModal';
import SecurityDiagnosticPanel from '../components/SecurityDiagnosticPanel';
import { isAdminRole } from '../utils/roles';

export default function ClientInventory() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [equipments, setEquipments] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('Todas');
  const [activeTab, setActiveTab] = useState('inventory');
  const [search, setSearch] = useState('');
  const [selectedAsset, setSelectedAsset] = useState(null);
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = isAdminRole(currentUser.role);

  const categories = [
    { name: 'Todas', icon: LayoutGrid, desc: 'Todos os ativos' },
    { name: 'Notebooks', icon: Laptop, desc: 'Portáteis e Ultrabooks' },
    { name: 'Desktops', icon: Monitor, desc: 'Estações de Trabalho' },
    { name: 'Servidores', icon: Server, desc: 'Infraestrutura Crítica' },
    { name: 'Ativos de Rede', icon: Network, desc: 'Switches e Racks' },
    { name: 'Roteadores', icon: Router, desc: 'Conectividade e Borda' },
    { name: 'Outros', icon: Box, desc: 'Periféricos e Diversos' },
  ];

  const fetchData = async () => {
    setLoading(true);
    try {
      const [clientRes, equipRes, statsRes] = await Promise.all([
        api.get(`/clients/${id}`),
        api.get(`/equipments?client_id=${id}`),
        api.get(`/clients/${id}/stats`)
      ]);
      setClient(clientRes.data);
      setEquipments(equipRes.data);
      setStats(statsRes.data);
    } catch (err) {
      toast.error('Erro ao carregar dados do inventário');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  // ESC handler
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && selectedAsset) setSelectedAsset(null);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [selectedAsset]);

  const filteredEquipments = equipments.filter(e => {
    const matchesCategory = activeCategory === 'Todas' || e.categoria === activeCategory;
    const nome = (e.nome || '').toLowerCase();
    const patrimonio = (e.patrimonio || '').toLowerCase();
    const ip = e.ip || '';
    const matchesSearch = nome.includes(search.toLowerCase()) || 
                          patrimonio.includes(search.toLowerCase()) ||
                          ip.includes(search);
    return matchesCategory && matchesSearch;
  });

  const handleDelete = async (eqId) => {
    if (window.confirm('Tem certeza que deseja desativar este equipamento? O historico sera preservado.')) {
      try {
        await api.delete(`/equipments/${eqId}`);
        toast.success('Equipamento desativado');
        fetchData();
      } catch (err) {
        toast.error('Erro ao desativar');
      }
    }
  };

  const handleExport = () => {
    const token = localStorage.getItem('token');
    window.open(`${API_URL}/api/reports/export-csv?client_id=${id}&token=${token}`, '_blank');
  };

  const handleDownloadAgent = async () => {
    const toastId = toast.loading(`Gerando agente para ${client.name}...`);
    try {
      const response = await api.get(`/clients/${id}/agent-package`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const fileName = `Agente_Goldtech_${client.name.replace(/\s+/g, '_')}.zip`;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('Agente gerado com sucesso!', { id: toastId });
    } catch (err) {
      toast.error('Erro ao gerar pacote do agente', { id: toastId });
    }
  };

  if (!client && !loading) return <div className="p-20 text-center">Cliente não encontrado.</div>;

  return (
    <div className="animate-fade content-stack">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        <button 
          onClick={() => navigate('/clientes')} 
          style={{ width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)', borderRadius: '14px', color: 'var(--text-light)', cursor: 'pointer' }}
        >
          <ChevronLeft size={24} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fff', margin: 0 }}>{client?.name}</h1>
            <span className="status-badge status-active" style={{ height: '24px' }}>{client?.status}</span>
          </div>
          <p style={{ color: 'var(--text-light)', fontWeight: 600, fontSize: '0.9rem' }}>Inventário Detalhado • CNPJ {client?.cnpj}</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={handleDownloadAgent} className="btn-outline-premium" style={{ height: '42px', padding: '0 1rem', borderColor: 'var(--primary-gold)', color: 'var(--primary-gold)' }}>
            <Download size={16} /> Gerar Agente
          </button>
          <button onClick={handleExport} className="btn-outline-premium" style={{ height: '42px', padding: '0 1rem' }}>
            <Download size={16} /> Exportar
          </button>
          <button onClick={() => navigate(`/novo?client_id=${id}`)} className="btn-premium" style={{ height: '42px', padding: '0 1rem' }}>
            <Plus size={16} strokeWidth={3} /> Novo Ativo
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="glass-panel" style={{ padding: '8px', display: 'inline-flex', gap: '8px', alignSelf: 'flex-start' }}>
        <button
          onClick={() => setActiveTab('inventory')}
          style={{
            height: '42px',
            padding: '0 1rem',
            borderRadius: '12px',
            border: activeTab === 'inventory' ? '1px solid var(--primary-gold)' : '1px solid transparent',
            background: activeTab === 'inventory' ? 'rgba(212,175,55,0.1)' : 'transparent',
            color: activeTab === 'inventory' ? 'var(--primary-gold)' : 'var(--text-light)',
            cursor: 'pointer',
            fontWeight: 800,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Package size={16} />
          Inventário
        </button>
        <button
          onClick={() => setActiveTab('security')}
          style={{
            height: '42px',
            padding: '0 1rem',
            borderRadius: '12px',
            border: activeTab === 'security' ? '1px solid var(--primary-gold)' : '1px solid transparent',
            background: activeTab === 'security' ? 'rgba(212,175,55,0.1)' : 'transparent',
            color: activeTab === 'security' ? 'var(--primary-gold)' : 'var(--text-light)',
            cursor: 'pointer',
            fontWeight: 800,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <ShieldCheck size={16} />
          Diagnóstico de Segurança
        </button>
      </div>

      {activeTab === 'inventory' ? (
        <>
      {/* KPI Grid */}
      <div className="card-grid-4">
        <div className="glass-panel" style={{ padding: '24px', height: '140px', borderRadius: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ color: 'var(--primary-gold)', background: 'rgba(212, 175, 55, 0.1)', padding: '8px', borderRadius: '10px' }}>
            <Package size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#fff', lineHeight: 1 }}>{stats?.total || 0}</div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-light)', letterSpacing: '0.5px', marginTop: '4px' }}>Total de Ativos</div>
          </div>
        </div>
        <div className="glass-panel" style={{ padding: '24px', height: '140px', borderRadius: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ color: 'var(--accent-emerald)', background: 'rgba(16, 185, 129, 0.1)', padding: '8px', borderRadius: '10px' }}>
            <Activity size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#fff', lineHeight: 1 }}>{(stats?.total || 0) - (stats?.maintenance || 0)}</div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-light)', letterSpacing: '0.5px', marginTop: '4px' }}>Em Operação</div>
          </div>
        </div>
        <div className="glass-panel" style={{ padding: '24px', height: '140px', borderRadius: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ color: 'var(--accent-orange)', background: 'rgba(245, 158, 11, 0.1)', padding: '8px', borderRadius: '10px' }}>
            <Activity size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#fff', lineHeight: 1 }}>{stats?.maintenance || 0}</div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-light)', letterSpacing: '0.5px', marginTop: '4px' }}>Em Manutenção</div>
          </div>
        </div>
        <div className="glass-panel" style={{ padding: '24px', height: '140px', borderRadius: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ color: 'var(--accent-red)', background: 'rgba(239, 68, 68, 0.1)', padding: '8px', borderRadius: '10px' }}>
            <Clock size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#fff', lineHeight: 1 }}>{stats?.no_collection || 0}</div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-light)', letterSpacing: '0.5px', marginTop: '4px' }}>Sem Coleta</div>
          </div>
        </div>
      </div>

      {/* Categorias */}
      <div>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', marginBottom: '20px' }}>Categorias de Equipamentos</h3>
        <div className="card-grid-3">
          {categories.map((cat) => (
            <div
              key={cat.name}
              onClick={() => setActiveCategory(cat.name)}
              className={`glass-panel ${activeCategory === cat.name ? 'active-category' : ''}`}
              style={{ 
                padding: '24px', 
                minHeight: '140px', 
                borderRadius: '20px', 
                cursor: 'pointer',
                border: activeCategory === cat.name ? '2px solid var(--primary-gold)' : '1px solid var(--border-glass)',
                background: activeCategory === cat.name ? 'rgba(212, 175, 55, 0.05)' : 'rgba(255,255,255,0.03)',
                transition: 'all 0.3s ease',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ color: activeCategory === cat.name ? 'var(--primary-gold)' : 'var(--text-light)', background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '8px' }}>
                  <cat.icon size={20} />
                </div>
                {activeCategory === cat.name && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary-gold)' }}></div>}
              </div>
              <div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>{cat.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '4px' }}>{cat.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <div style={{ position: 'relative', width: '100%' }}>
          <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)', opacity: 0.5 }} size={20} />
          <input
            type="text"
            className="form-control-premium"
            placeholder={`Buscar em ${activeCategory}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: '3.5rem', height: '52px' }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <table className="table-enterprise">
          <thead>
            <tr>
              <th>Equipamento</th>
              <th>Patrimônio / SN</th>
              <th>Local / Setor</th>
              <th>IP / MAC</th>
              <th>Status</th>
              <th>Última Coleta</th>
              <th className="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-light)' }}>Sincronizando...</td></tr>
            ) : filteredEquipments.length === 0 ? (
              <tr><td colSpan="7" style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-light)' }}>Nenhum equipamento nesta categoria.</td></tr>
            ) : (
              filteredEquipments.map((eq) => (
                <tr key={eq.id}>
                  <td>
                    {/* CLIQUE NO NOME ABRE O MODAL */}
                    <div 
                      onClick={() => setSelectedAsset(eq)} 
                      style={{ fontWeight: 700, color: 'var(--primary-gold)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      {eq.nome} <ExternalLink size={12} opacity={0.5} />
                    </div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-light)', textTransform: 'uppercase' }}>{eq.fabricante} {eq.modelo}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 800, color: 'var(--primary-gold)' }}>{eq.patrimonio}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-light)' }}>S/N: {eq.numero_serie || '-'}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: '#fff' }}>{eq.localizacao || '-'}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-light)' }}>{eq.setor || '-'}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--accent-blue)' }}>{eq.ip || '-'}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-light)' }}>{eq.mac || '-'}</div>
                  </td>
                  <td>
                    <span className={`status-badge ${eq.status === 'Ativo' ? 'status-active' : eq.status === 'Manutenção' ? 'status-maintenance' : 'status-retired'}`}>
                      {eq.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-light)' }}>
                      {eq.ultima_coleta ? new Date(eq.ultima_coleta).toLocaleString() : 'Sem coleta'}
                    </div>
                  </td>
                  <td className="text-right">
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                      <button onClick={() => navigate(`/editar/${eq.id}`)} style={{ background: 'transparent', border: 'none', color: 'var(--text-light)', cursor: 'pointer' }}>
                        <Edit2 size={18} />
                      </button>
                      {isAdmin && (
                        <button onClick={() => handleDelete(eq.id)} style={{ background: 'transparent', border: 'none', color: 'var(--accent-red)', cursor: 'pointer' }}>
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de Detalhes */}
      <AssetDetailsModal 
        asset={selectedAsset} 
        onClose={() => setSelectedAsset(null)} 
        onUpdate={fetchData}
      />
        </>
      ) : (
        <SecurityDiagnosticPanel clientId={id} clientName={client?.name} />
      )}
    </div>
  );
}
