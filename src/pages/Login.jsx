import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Lock, Mail, ArrowRight, Loader, Package, ShieldCheck, Activity } from 'lucide-react';
import bgLogin from '../assets/bg-login.png';
import logoGoldtech from '../assets/logo-goldtech.png';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/login', { username, password });
      console.log('Resposta login:', data);

      // Salva apenas o JWT real
      localStorage.setItem('token', data.token);
      // Salva o objeto user separado
      localStorage.setItem('user', JSON.stringify(data.user));
      toast.success('Acesso autorizado! Bem-vindo ao Inventário.');
      navigate('/');
    } catch (err) {
      console.log('Erro login:', err);
      toast.error(err.response?.data?.message || 'Falha na autenticação');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden',
      backgroundColor: '#030712',
    }}>
      {/* Background Image */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `url(${bgLogin})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        zIndex: 0,
        pointerEvents: 'none'
      }} />

      {/* Gradient Overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(90deg, rgba(3,7,18,0.92) 0%, rgba(3,7,18,0.7) 50%, rgba(3,7,18,0.92) 100%)',
        zIndex: 0,
        pointerEvents: 'none'
      }} />

      {/* Glows */}
      <div style={{
        position: 'absolute', top: '10%', left: '-10%',
        width: '600px', height: '600px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(212,175,55,0.08) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0
      }} />
      <div style={{
        position: 'absolute', bottom: '10%', right: '-10%',
        width: '600px', height: '600px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0
      }} />

      <div className="login-grid-wrapper" style={{
        width: '100%',
        maxWidth: '1380px',
        margin: '0 auto',
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 540px',
        gap: '100px',
        alignItems: 'center',
        padding: '48px 64px',
        position: 'relative',
        zIndex: 10
      }}>
        {/* Lado Esquerdo: Institucional */}
        <div className="login-left-panel animate-fade">
          <h1 style={{ fontSize: 'clamp(40px, 4.5vw, 64px)', fontWeight: 800, color: '#fff', marginBottom: '1.5rem', lineHeight: 1.05, letterSpacing: '-0.02em' }}>
            Gestão de <span style={{ color: '#D4AF37' }}>ativos</span>.<br />Controle de <span style={{ color: '#D4AF37' }}>patrimônio</span>.
          </h1>
          <p style={{ fontSize: '18px', color: 'rgba(255,255,255,0.75)', marginBottom: '3.5rem', lineHeight: 1.7, maxWidth: '600px' }}>
            Bem-vindo ao Goldtech Inventário. Otimize o rastreamento de equipamentos, gerencie garantias e mantenha o controle total do seu ecossistema de TI.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3rem' }}>
            <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', boxShadow: '0 0 20px rgba(16, 185, 129, 0.1)' }}>
                <Package size={28} />
              </div>
              <div>
                <h4 style={{ color: '#fff', margin: 0, fontSize: '18px', fontWeight: 700 }}>Inventário</h4>
                <p style={{ color: 'rgba(255,255,255,0.4)', margin: '4px 0 0 0', fontSize: '14px', fontWeight: 500 }}>Controle de hardware</p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', boxShadow: '0 0 20px rgba(16, 185, 129, 0.1)' }}>
                <Activity size={28} />
              </div>
              <div>
                <h4 style={{ color: '#fff', margin: 0, fontSize: '18px', fontWeight: 700 }}>Manutenção</h4>
                <p style={{ color: 'rgba(255,255,255,0.4)', margin: '4px 0 0 0', fontSize: '14px', fontWeight: 500 }}>Histórico técnico</p>
              </div>
            </div>
          </div>
        </div>

        {/* Lado Direito: Card de Login */}
        <div className="login-right-panel animate-fade" style={{ animationDelay: '0.1s' }}>
          <div className="glass-panel" style={{
            padding: '64px',
            background: 'rgba(7, 12, 24, 0.85)',
            boxShadow: '0 0 0 1px rgba(16,185,129,0.1), 0 32px 100px rgba(0,0,0,0.6), 0 -2px 30px rgba(16,185,129,0.15)',
          }}>
            <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
              <img src={logoGoldtech} alt="Goldtech" style={{ width: '220px', display: 'block', margin: '0 auto 32px auto' }} />
              <h2 style={{ fontSize: '32px', fontWeight: 800, color: '#fff', margin: '0 0 12px' }}>Acesso ao Sistema</h2>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '16px', fontWeight: 500 }}>Portal de Inventário de Equipamentos</p>
            </div>

            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 800, color: 'rgba(255,255,255,0.4)', marginLeft: '4px' }}>Usuário</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={20} style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)', pointerEvents: 'none' }} />
                  <input
                    type="text"
                    className="form-control-premium"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    placeholder="Digite seu usuário"
                    style={{ paddingLeft: '56px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 800, color: 'rgba(255,255,255,0.4)', marginLeft: '4px' }}>Senha</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={20} style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)', pointerEvents: 'none' }} />
                  <input
                    type="password"
                    className="form-control-premium"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    style={{ paddingLeft: '56px' }}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn-premium"
                disabled={loading}
                style={{ height: '64px', fontSize: '1.1rem', marginTop: '16px' }}
              >
                {loading ? (
                  <><Loader className="animate-spin" size={24} /> Autenticando...</>
                ) : (
                  <>Acessar Painel <ArrowRight size={24} /></>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

      <footer style={{
        position: 'absolute', bottom: '2.5rem', left: 0, right: 0,
        color: 'rgba(255,255,255,0.35)', fontSize: '13px', fontWeight: 500,
        textAlign: 'center', zIndex: 2
      }}>
        © {new Date().getFullYear()} Goldtech Soluções em Tecnologia. Todos os direitos reservados.
      </footer>
    </div>
  );
}
