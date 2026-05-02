import { useEffect, useState, useRef } from 'react';
import api, { API_URL } from '../services/api';
import { 
  Search, Plus, Download, Edit2, Trash2, Filter, 
  MoreVertical, Package, ExternalLink, Move, LayoutGrid, 
  RefreshCw, Eye, Monitor, Laptop, Server, Router, Network, Box, X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import AssetDetailsModal from '../components/AssetDetailsModal';

export default function EquipmentList() {
  const [equipments, setEquipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [modalView, setModalView] = useState('details');
  const [menuOpen, setMenuOpen] = useState(null);
  const navigate = useNavigate();
  const dropdownRef = useRef(null);

  const fetchEquipments = async () => {
    setLoading(true);
    try {
      const response = await api.get('/equipments', { params });
      setEquipments(response.data || []);
    } catch (err) {
      toast.error('Erro ao carregar equipamentos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEquipments();
  }, [statusFilter]);

  // Global ESC handler
  useEffect(() => {
    const handleGlobalEsc = (e) => {
      if (e.key === 'Escape') {
        if (menuOpen) setMenuOpen(null);
        else if (selectedAsset) setSelectedAsset(null);
      }
    };
    window.addEventListener('keydown', handleGlobalEsc);
    return () => window.removeEventListener('keydown', handleGlobalEsc);
  }, [menuOpen, selectedAsset]);

  // Click outside handler for dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setMenuOpen(null);
      }
    };
    if (menuOpen) {
      window.addEventListener('mousedown', handleClickOutside);
    }
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const handleExport = () => {
    window.open(`${API_URL}/api/equipments/export?token=${localStorage.getItem('token')}`, '_blank');
  };

  const handleDelete = async (id) => {
    setMenuOpen(null);
    if (window.confirm('Tem certeza que deseja excluir este equipamento?')) {
      try {
        await api.delete(`/equipments/${id}`);
        toast.success('Equipamento removido');
        fetchEquipments();
      } catch (err) {
        toast.error('Erro ao remover equipamento');
      }
    }
  };

  const getCategoryBadge = (cat) => {
    const styles = {
      'Notebooks': { bg: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', icon: Laptop },
      'Servidores': { bg: 'rgba(16, 185, 129, 0.1)', color: '#10b981', icon: Server },
      'Roteadores': { bg: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', icon: Router },
      'Desktops': { bg: 'rgba(255, 255, 255, 0.05)', color: '#fff', icon: Monitor },
      'Ativos de Rede': { bg: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', icon: Network },
    };
    const style = styles[cat] || { bg: 'rgba(255,255,255,0.05)', color: 'var(--text-light)', icon: Box };
    const Icon = style.icon;

    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: style.bg, color: style.color, padding: '4px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', fontSize: '0.75rem', fontWeight: 700 }}>
        <Icon size={12} /> {cat || 'Outros'}
      </div>
    );
  };

  return (
    <div className="animate-fade">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '3rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '0.75rem' }}>
            <div style={{ padding: '8px', background: 'rgba(212, 175, 55, 0.1)', borderRadius: '10px', color: 'var(--primary-gold)' }}>
              <Package size={24} />
            </div>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#fff', margin: 0 }}>Inventário <span style={{ color: 'var(--primary-gold)' }}>Geral</span></h1>
          </div>
          <p style={{ color: 'var(--text-light)', fontWeight: 500 }}>Gestão centralizada de todos os ativos da Goldtech.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={handleExport} className="btn-outline-premium">
            <Download size={18} /> Exportar
          </button>
          <button onClick={() => navigate('/novo')} className="btn-premium">
            <Plus size={18} strokeWidth={3} /> Novo Ativo
          </button>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)', opacity: 0.5 }} size={20} />
            <input
              type="text"
              className="form-control-premium"
              placeholder="Buscar por hostname, patrimônio ou cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchEquipments()}
              style={{ paddingLeft: '3.5rem' }}
            />
          </div>
          <select 
            className="form-control-premium" 
            style={{ width: '240px' }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Todos os Status</option>
            <option value="Ativo">Ativo</option>
            <option value="Manutenção">Manutenção</option>
            <option value="Desativado">Desativado</option>
          </select>
          <button onClick={fetchEquipments} className="btn-premium" style={{ width: '120px' }}>Buscar</button>
        </div>
      </div>

      <div className="animate-fade">
        <table className="table-enterprise">
          <thead>
            <tr>
              <th>Dispositivo</th>
              <th>Especificação</th>
              <th>Categoria</th>
              <th>Status</th>
              <th>Cliente / Alocação</th>
              <th className="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: '4rem' }}>Carregando inventário...</td></tr>
            ) : (Array.isArray(equipments) ? equipments : []).map((item) => (
              <tr key={item.id}>
                <td>
                  <div 
                    onClick={() => { setSelectedAsset(item); setModalView('details'); }} 
                    style={{ fontWeight: 800, color: 'var(--primary-gold)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    {item?.nome || 'Equipamento sem nome'} <ExternalLink size={12} opacity={0.5} />
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-light)' }}>SN: {item?.numero_serie || 'N/A'}</div>
                </td>
                <td>
                  <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.9rem' }}>{item?.processador || 'N/A'}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>{item?.memoria_ram || 'N/A'} / {item?.sistema_operacional || 'N/A'}</div>
                </td>
                <td>{getCategoryBadge(item.categoria)}</td>
                <td>
                  <span className={`status-badge ${item.status === 'Ativo' ? 'status-active' : item.status === 'Manutenção' ? 'status-maintenance' : 'status-retired'}`}>
                    {item.status}
                  </span>
                </td>
                <td>
                  <div style={{ fontWeight: 700, color: '#fff' }}>{item?.client_name || '-'}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>{item?.localizacao || 'Sem local'}</div>
                </td>
                <td className="text-right" style={{ overflow: 'visible' }}>
                  <div style={{ position: 'relative', display: 'flex', justifyContent: 'flex-end' }}>
                    <button 
                      onClick={() => setMenuOpen(menuOpen === item.id ? null : item.id)}
                      className={`btn-outline-premium ${menuOpen === item.id ? 'active' : ''}`}
                      style={{ padding: '8px', border: 'none', background: menuOpen === item.id ? 'rgba(255,255,255,0.05)' : 'transparent' }}
                    >
                      <MoreVertical size={20} />
                    </button>
                    
                    {menuOpen === item.id && (
                      <div 
                        ref={dropdownRef}
                        className="glass-panel animate-fade" 
                        style={{ 
                          position: 'absolute', 
                          top: '100%', 
                          right: 0, 
                          zIndex: 100, 
                          minWidth: '220px', 
                          padding: '10px', 
                          boxShadow: '0 15px 40px rgba(0,0,0,0.6)', 
                          marginTop: '8px',
                          border: '1px solid rgba(255,255,255,0.1)',
                          background: '#0b0f14'
                        }}
                      >
                        <button onClick={() => { setSelectedAsset(item); setModalView('details'); setMenuOpen(null); }} className="sidebar-link" style={{ margin: 0, width: '100%', padding: '12px', justifyContent: 'flex-start', gap: '12px' }}>
                          <Eye size={16} color="var(--primary-gold)" /> <span>Ver Detalhes</span>
                        </button>
                        <button onClick={() => navigate(`/editar/${item.id}`)} className="sidebar-link" style={{ margin: 0, width: '100%', padding: '12px', justifyContent: 'flex-start', gap: '12px' }}>
                          <Edit2 size={16} /> <span>Editar Ativo</span>
                        </button>
                        <button onClick={() => { setSelectedAsset(item); setModalView('move'); setMenuOpen(null); }} className="sidebar-link" style={{ margin: 0, width: '100%', padding: '12px', justifyContent: 'flex-start', gap: '12px' }}>
                          <Move size={16} /> <span>Mover Cliente</span>
                        </button>
                        <button onClick={() => { setSelectedAsset(item); setModalView('category'); setMenuOpen(null); }} className="sidebar-link" style={{ margin: 0, width: '100%', padding: '12px', justifyContent: 'flex-start', gap: '12px' }}>
                          <LayoutGrid size={16} /> <span>Alterar Categoria</span>
                        </button>
                        <div style={{ borderTop: '1px solid var(--border-glass)', margin: '6px 0' }}></div>
                        <button onClick={() => handleDelete(item.id)} className="sidebar-link" style={{ margin: 0, width: '100%', padding: '12px', justifyContent: 'flex-start', gap: '12px', color: 'var(--accent-red)' }}>
                          <Trash2 size={16} /> <span>Excluir Ativo</span>
                        </button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AssetDetailsModal 
        asset={selectedAsset} 
        onClose={() => setSelectedAsset(null)} 
        onUpdate={fetchEquipments}
        initialView={modalView}
      />
    </div>
  );
}
