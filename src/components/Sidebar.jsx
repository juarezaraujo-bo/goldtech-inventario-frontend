import { Link, useNavigate, useLocation } from 'react-router-dom';
import { BookOpen, GraduationCap, LayoutDashboard, Users, Package, FileText, Settings, LogOut, ShieldCheck, User, UserCog } from 'lucide-react';

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const menuItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Clientes', path: '/clientes', icon: Users },
    { name: 'Inventário Geral', path: '/equipamentos', icon: Package },
    { name: 'DocumentaÃ§Ã£o', path: '/intranet', icon: BookOpen },
    { name: 'Conhecimento', path: '/conhecimento', icon: GraduationCap },
    { name: 'Monitoramento', path: '/relatorios', icon: FileText },
    { name: 'Usuários', path: '/usuarios', icon: UserCog },
    { name: 'Configurações', path: '/configuracoes', icon: Settings },
  ];

  return (
    <aside style={{
      width: '260px',
      backgroundColor: 'var(--bg-sidebar)',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      borderRight: '1px solid var(--border-glass)',
      padding: '2rem 1.5rem',
      position: 'fixed',
      left: 0,
      top: 0,
      zIndex: 100
    }} className="hidden lg:flex">
      <div style={{ marginBottom: '3.5rem', padding: '0 0.5rem' }}>
        <div className="flex items-center gap-3">
          <div style={{
            width: '44px',
            height: '44px',
            background: 'rgba(212, 175, 55, 0.1)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--primary-gold)',
            boxShadow: '0 0 20px rgba(212, 175, 55, 0.1)'
          }}>
            <ShieldCheck size={28} strokeWidth={2.5} />
          </div>
          <div>
            <span style={{ display: 'block', fontSize: '1.25rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>GOLDTECH</span>
            <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: 800, color: 'var(--primary-gold)', letterSpacing: '2px', marginTop: '-2px' }}>INVENTÁRIO</span>
          </div>
        </div>
      </div>

      <nav style={{ flex: 1 }}>
        <p style={{ fontSize: '0.7rem', fontWeight: 800, color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '1.5rem', paddingLeft: '1rem' }}>
          Sistema
        </p>
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`sidebar-link ${isActive ? 'active' : ''}`}
            >
              <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border-glass)', paddingTop: '2rem' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '1rem',
          background: 'rgba(255,255,255,0.03)',
          borderRadius: '16px',
          marginBottom: '1.5rem'
        }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--primary-gold)', color: '#000', display: 'flex', alignItems: 'center', justifycenter: 'center' }}>
            <User size={20} strokeWidth={2.5} />
          </div>
          <div style={{ overflow: 'hidden' }}>
            <p style={{ color: '#fff', fontSize: '0.875rem', fontWeight: 700, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name || 'Admin'}</p>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', margin: 0 }}>{user.role || 'Operador'}</p>
          </div>
        </div>
        
        <button
          onClick={handleLogout}
          className="sidebar-link"
          style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--accent-red)' }}
        >
          <LogOut size={20} />
          <span>Sair do Sistema</span>
        </button>
      </div>
    </aside>
  );
}
