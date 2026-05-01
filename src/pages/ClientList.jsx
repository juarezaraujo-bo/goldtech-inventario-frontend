import { useEffect, useState, useRef } from 'react';
import api from '../services/api';
import { Search, Plus, Users, ChevronRight, Building2, Mail, Phone, Package, MoreVertical, PowerOff, Power, Trash2, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function ClientList() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null); // client object
  const navigate = useNavigate();
  const menuRef = useRef(null);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/clients');
      setClients(data);
    } catch (err) {
      toast.error('Erro ao carregar clientes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchClients(); }, []);

  // Fechar menu ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpenId(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSetStatus = async (client, newStatus) => {
    setMenuOpenId(null);
    try {
      await api.patch(`/clients/${client.id}/status`, { status: newStatus });
      toast.success(`Cliente ${newStatus === 'Ativo' ? 'reativado' : 'desativado'} com sucesso`);
      fetchClients();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro ao alterar status');
    }
  };

  const handleDeleteRequest = (client) => {
    setMenuOpenId(null);
    setConfirmDelete(client);
  };

  const handleDeleteConfirm = async () => {
    try {
      await api.delete(`/clients/${confirmDelete.id}`);
      toast.success('Cliente excluído com sucesso');
      setConfirmDelete(null);
      fetchClients();
    } catch (err) {
      const msg = err.response?.data?.message || 'Erro ao excluir cliente';
      toast.error(msg, { duration: 6000 });
      setConfirmDelete(null);
    }
  };

  const filteredClients = clients.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.cnpj && c.cnpj.includes(search));
    const matchStatus = showInactive ? true : c.status !== 'Inativo';
    return matchSearch && matchStatus;
  });

  const inactiveCount = clients.filter(c => c.status === 'Inativo').length;

  return (
    <div className="animate-fade">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.5rem' }}>
            <div style={{ padding: '6px', background: 'rgba(212, 175, 55, 0.1)', borderRadius: '8px', color: 'var(--primary-gold)' }}>
              <Users size={20} />
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fff', margin: 0 }}>Gestão de <span style={{ color: 'var(--primary-gold)' }}>Clientes</span></h1>
          </div>
          <p style={{ color: 'var(--text-light)', fontWeight: 500, fontSize: '0.9rem' }}>Administração de empresas e ativos vinculados.</p>
        </div>
        <button onClick={() => navigate('/clientes/novo')} className="btn-premium" style={{ height: '42px', padding: '0 1.25rem' }}>
          <Plus size={16} strokeWidth={3} /> Novo Cliente
        </button>
      </div>

      <div className="glass-panel search-panel" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)', opacity: 0.5 }} size={18} />
          <input
            type="text"
            className="form-control-premium search-input"
            placeholder="Buscar empresa ou CNPJ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: '3.25rem' }}
          />
        </div>
        {inactiveCount > 0 && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', whiteSpace: 'nowrap', color: 'var(--text-light)', fontSize: '0.8rem', fontWeight: 700 }}>
            <input
              type="checkbox"
              checked={showInactive}
              onChange={e => setShowInactive(e.target.checked)}
              style={{ width: '16px', height: '16px', accentColor: 'var(--primary-gold)' }}
            />
            Mostrar inativos ({inactiveCount})
          </label>
        )}
      </div>

      <div className="clients-grid">
        {loading ? (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '4rem', color: 'var(--text-light)' }}>Sincronizando...</div>
        ) : filteredClients.length === 0 ? (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '4rem', color: 'var(--text-light)' }}>Nenhum cliente encontrado.</div>
        ) : (
          filteredClients.map((client) => (
            <div
              key={client.id}
              className="client-card"
              style={{ opacity: client.status === 'Inativo' ? 0.6 : 1 }}
            >
              <div className="client-card-body" onClick={() => navigate(`/clientes/${client.id}/inventario`)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(212, 175, 55, 0.1)', color: 'var(--primary-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Building2 size={22} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className={`status-badge ${client.status === 'Ativo' ? 'status-active' : 'status-retired'}`} style={{ fontSize: '0.65rem' }}>
                      {client.status}
                    </span>
                    {/* Menu de ações */}
                    <div style={{ position: 'relative' }} ref={menuOpenId === client.id ? menuRef : null}>
                      <button
                        onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === client.id ? null : client.id); }}
                        style={{ background: 'none', border: 'none', color: 'var(--text-light)', cursor: 'pointer', padding: '4px', borderRadius: '6px', display: 'flex', alignItems: 'center' }}
                      >
                        <MoreVertical size={16} />
                      </button>
                      {menuOpenId === client.id && (
                        <div
                          onClick={e => e.stopPropagation()}
                          style={{ position: 'absolute', right: 0, top: '110%', background: 'var(--bg-card)', border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '6px', zIndex: 50, minWidth: '180px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', backdropFilter: 'blur(20px)' }}
                        >
                          {client.status === 'Ativo' ? (
                            <button
                              onClick={() => handleSetStatus(client, 'Inativo')}
                              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'none', border: 'none', color: '#f59e0b', cursor: 'pointer', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 700 }}
                            >
                              <PowerOff size={15} /> Desativar Cliente
                            </button>
                          ) : (
                            <button
                              onClick={() => handleSetStatus(client, 'Ativo')}
                              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'none', border: 'none', color: 'var(--accent-emerald)', cursor: 'pointer', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 700 }}
                            >
                              <Power size={15} /> Reativar Cliente
                            </button>
                          )}
                          <div style={{ height: '1px', background: 'var(--border-glass)', margin: '4px 0' }} />
                          <button
                            onClick={() => handleDeleteRequest(client)}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 700 }}
                          >
                            <Trash2 size={15} /> Excluir Cliente
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff', marginBottom: '0.25rem' }}>{client.name}</h3>
                <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-light)', marginBottom: '4px' }}>CNPJ: {client.cnpj || 'Não informado'}</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-light)' }}>
                    <Mail size={12} /> {client.email || 'Sem e-mail'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-light)' }}>
                    <Phone size={12} /> {client.phone || 'Sem telefone'}
                  </div>
                </div>
              </div>

              <div className="client-card-footer" onClick={() => navigate(`/clientes/${client.id}/inventario`)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary-gold)' }}>
                    <Package size={14} />
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}>Ver Inventário</span>
                  </div>
                  <ChevronRight size={16} color="var(--primary-gold)" />
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal de confirmação de exclusão */}
      {confirmDelete && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="glass-panel animate-scale"
            style={{ maxWidth: '440px', width: '100%', padding: '2.5rem', borderRadius: '20px' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
              <div style={{ padding: '10px', background: 'rgba(239,68,68,0.1)', borderRadius: '12px' }}>
                <AlertTriangle size={24} color="#ef4444" />
              </div>
              <div>
                <h3 style={{ color: '#fff', fontWeight: 800, fontSize: '1.1rem', margin: 0 }}>Confirmar Exclusão</h3>
                <p style={{ color: 'var(--text-light)', fontSize: '0.8rem', margin: 0 }}>Esta ação não pode ser desfeita</p>
              </div>
            </div>
            <p style={{ color: 'var(--text-light)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '2rem' }}>
              Você está prestes a excluir permanentemente o cliente <strong style={{ color: '#fff' }}>{confirmDelete.name}</strong>. Clientes com equipamentos vinculados não podem ser excluídos.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setConfirmDelete(null)} className="btn-outline-premium" style={{ flex: 1, height: '46px' }}>
                Cancelar
              </button>
              <button
                onClick={handleDeleteConfirm}
                style={{ flex: 1, height: '46px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444', borderRadius: '12px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <Trash2 size={16} /> Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
