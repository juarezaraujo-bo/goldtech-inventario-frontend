import { useEffect, useState } from 'react';
import {
  Users, UserPlus, Edit2, Trash2, KeyRound, X,
  CheckCircle, ShieldCheck, User, Eye, EyeOff, Save
} from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

/* ─── Modal genérico ─── */
function Modal({ title, icon: Icon, iconColor, onClose, children }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, backdropFilter: 'blur(4px)'
    }}>
      <div className="glass-panel" style={{
        width: '460px', maxWidth: '95vw', padding: '2.5rem',
        border: '1px solid var(--border-glass)', borderRadius: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '2rem' }}>
          <div style={{ background: `${iconColor}18`, padding: '10px', borderRadius: '12px', color: iconColor }}>
            <Icon size={22} />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-light)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ─── Campo de senha com toggle ─── */
function PasswordField({ label, value, onChange, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <label style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-light)' }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          type={show ? 'text' : 'password'}
          className="form-control-premium"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          style={{ paddingRight: '48px' }}
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-light)', cursor: 'pointer' }}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modais
  const [modalCreate, setModalCreate] = useState(false);
  const [modalEdit, setModalEdit]     = useState(null); // user object
  const [modalPwd, setModalPwd]       = useState(null); // user object (null = own)

  // Forms
  const [formCreate, setFormCreate] = useState({ name: '', email: '', password: '', role: 'user' });
  const [formEdit, setFormEdit]     = useState({ name: '', email: '', role: 'user' });
  const [formPwd, setFormPwd]       = useState({ current_password: '', new_password: '', confirm_password: '' });

  const currentUser = JSON.parse(localStorage.getItem('goldtech_user') || '{}');
  const isAdmin = currentUser.role === 'admin';

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users');
      setUsers(response.data || []);
    } catch {
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  /* ── Criar ── */
  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/users', formCreate);
      toast.success('Usuário criado com sucesso!');
      setModalCreate(false);
      setFormCreate({ name: '', email: '', password: '', role: 'user' });
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro ao criar usuário');
    }
  };

  /* ── Editar ── */
  const openEdit = (user) => {
    setFormEdit({ name: user.name, email: user.email, role: user.role });
    setModalEdit(user);
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/users/${modalEdit.id}`, formEdit);
      toast.success('Usuário atualizado!');
      setModalEdit(null);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro ao atualizar');
    }
  };

  /* ── Alterar senha ── */
  const openPwd = (user) => {
    setFormPwd({ current_password: '', new_password: '', confirm_password: '' });
    setModalPwd(user); // null = própria senha
  };

  const handlePwd = async (e) => {
    e.preventDefault();
    if (formPwd.new_password !== formPwd.confirm_password) {
      return toast.error('A nova senha e a confirmação não coincidem.');
    }
    try {
      await api.put('/users/change-password', {
        current_password: formPwd.current_password,
        new_password: formPwd.new_password,
      });
      toast.success('Senha alterada com sucesso!');
      setModalPwd(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro ao alterar senha');
    }
  };

  /* ── Excluir ── */
  const handleDelete = async (user) => {
    if (!window.confirm(`Excluir o usuário "${user.name}"?`)) return;
    try {
      await api.delete(`/users/${user.id}`);
      toast.success('Usuário excluído.');
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro ao excluir');
    }
  };

  /* ── Badge de role ── */
  const RoleBadge = ({ role }) => (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '3px 10px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800,
      textTransform: 'uppercase', letterSpacing: '0.5px',
      background: role === 'admin' ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.06)',
      color: role === 'admin' ? 'var(--primary-gold)' : 'var(--text-light)',
      border: `1px solid ${role === 'admin' ? 'rgba(212,175,55,0.3)' : 'var(--border-glass)'}`,
    }}>
      {role === 'admin' ? <ShieldCheck size={11} /> : <User size={11} />}
      {role === 'admin' ? 'Admin' : 'Operador'}
    </span>
  );

  return (
    <div className="animate-fade">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2.5rem' }}>
        <div>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 900, color: '#fff', marginBottom: '0.5rem', letterSpacing: '-1px' }}>
            Usuários <span style={{ color: 'var(--primary-gold)' }}>do Sistema</span>
          </h1>
          <p style={{ color: 'var(--text-light)', fontWeight: 600 }}>Gerencie contas, permissões e senhas.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={() => openPwd(currentUser)} className="btn-outline-premium">
            <KeyRound size={16} /> Alterar Minha Senha
          </button>
          {isAdmin && (
            <button onClick={() => setModalCreate(true)} className="btn-premium">
              <UserPlus size={16} /> Novo Usuário
            </button>
          )}
        </div>
      </div>

      {/* Tabela */}
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
          <Users size={20} color="var(--primary-gold)" />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', margin: 0 }}>
            Contas de Acesso
          </h3>
          <span style={{ marginLeft: 'auto', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-light)' }}>
            {(users || []).length} usuário(s)
          </span>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-light)' }}>Carregando...</div>
        ) : (
          <table className="table-enterprise">
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Perfil</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {(Array.isArray(users) ? users : []).map(user => (
                <tr key={user.id}>
                  <td style={{ fontWeight: 700, color: '#fff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(212,175,55,0.1)', color: 'var(--primary-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <User size={15} />
                      </div>
                      {user?.name || 'Sem nome'}
                      {user?.id === currentUser?.id && (
                        <span style={{ fontSize: '0.65rem', color: 'var(--accent-emerald)', fontWeight: 800 }}>(você)</span>
                      )}
                    </div>
                  </td>
                  <td style={{ color: 'var(--text-light)', fontFamily: 'monospace', fontSize: '0.85rem' }}>{user?.email || 'Sem e-mail'}</td>
                  <td><RoleBadge role={user?.role} /></td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => openPwd(user)}
                        title="Alterar senha"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-glass)', borderRadius: '8px', padding: '6px 10px', color: 'var(--text-light)', cursor: 'pointer' }}
                      >
                        <KeyRound size={14} />
                      </button>
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => openEdit(user)}
                            title="Editar usuário"
                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-glass)', borderRadius: '8px', padding: '6px 10px', color: 'var(--primary-gold)', cursor: 'pointer' }}
                          >
                            <Edit2 size={14} />
                          </button>
                          {user?.id !== currentUser?.id && (
                            <button
                              onClick={() => handleDelete(user)}
                              title="Excluir"
                              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '6px 10px', color: '#ef4444', cursor: 'pointer' }}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Modal: Criar Usuário ── */}
      {modalCreate && (
        <Modal title="Novo Usuário" icon={UserPlus} iconColor="var(--accent-emerald)" onClose={() => setModalCreate(false)}>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-light)' }}>Nome Completo</label>
              <input className="form-control-premium" value={formCreate.name} onChange={e => setFormCreate({ ...formCreate, name: e.target.value })} placeholder="Ex: João Silva" required />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-light)' }}>E-mail</label>
              <input type="email" className="form-control-premium" value={formCreate.email} onChange={e => setFormCreate({ ...formCreate, email: e.target.value })} placeholder="joao@goldtech.com" required />
            </div>
            <PasswordField label="Senha" value={formCreate.password} onChange={e => setFormCreate({ ...formCreate, password: e.target.value })} placeholder="Mínimo 6 caracteres" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-light)' }}>Perfil</label>
              <select className="form-control-premium" value={formCreate.role} onChange={e => setFormCreate({ ...formCreate, role: e.target.value })}>
                <option value="user">Operador</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '0.5rem' }}>
              <button type="button" onClick={() => setModalCreate(false)} className="btn-outline-premium" style={{ flex: 1, height: '44px' }}>Cancelar</button>
              <button type="submit" className="btn-premium" style={{ flex: 1, height: '44px' }}><CheckCircle size={16} /> Criar Usuário</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Modal: Editar Usuário ── */}
      {modalEdit && (
        <Modal title="Editar Usuário" icon={Edit2} iconColor="var(--primary-gold)" onClose={() => setModalEdit(null)}>
          <form onSubmit={handleEdit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-light)' }}>Nome Completo</label>
              <input className="form-control-premium" value={formEdit.name} onChange={e => setFormEdit({ ...formEdit, name: e.target.value })} required />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-light)' }}>E-mail</label>
              <input type="email" className="form-control-premium" value={formEdit.email} onChange={e => setFormEdit({ ...formEdit, email: e.target.value })} required />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-light)' }}>Perfil</label>
              <select className="form-control-premium" value={formEdit.role} onChange={e => setFormEdit({ ...formEdit, role: e.target.value })}>
                <option value="user">Operador</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '0.5rem' }}>
              <button type="button" onClick={() => setModalEdit(null)} className="btn-outline-premium" style={{ flex: 1, height: '44px' }}>Cancelar</button>
              <button type="submit" className="btn-premium" style={{ flex: 1, height: '44px' }}><Save size={16} /> Salvar</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Modal: Alterar Senha ── */}
      {modalPwd && (
        <Modal title="Alterar Senha" icon={KeyRound} iconColor="var(--accent-emerald)" onClose={() => setModalPwd(null)}>
          <p style={{ color: 'var(--text-light)', fontSize: '0.85rem', marginBottom: '1.5rem', marginTop: '-0.5rem' }}>
            Alterando senha de: <strong style={{ color: '#fff' }}>{modalPwd.name}</strong>
          </p>
          <form onSubmit={handlePwd} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <PasswordField label="Senha Atual" value={formPwd.current_password} onChange={e => setFormPwd({ ...formPwd, current_password: e.target.value })} placeholder="Sua senha atual" />
            <PasswordField label="Nova Senha" value={formPwd.new_password} onChange={e => setFormPwd({ ...formPwd, new_password: e.target.value })} placeholder="Mínimo 6 caracteres" />
            <PasswordField label="Confirmar Nova Senha" value={formPwd.confirm_password} onChange={e => setFormPwd({ ...formPwd, confirm_password: e.target.value })} placeholder="Repita a nova senha" />
            <div style={{ display: 'flex', gap: '12px', marginTop: '0.5rem' }}>
              <button type="button" onClick={() => setModalPwd(null)} className="btn-outline-premium" style={{ flex: 1, height: '44px' }}>Cancelar</button>
              <button type="submit" className="btn-premium" style={{ flex: 1, height: '44px' }}><KeyRound size={16} /> Alterar Senha</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
