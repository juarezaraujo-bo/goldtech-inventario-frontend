import { useEffect, useState } from 'react';
import api from '../services/api';
import { Package, CheckCircle, AlertTriangle, XCircle, ArrowUpRight, Clock, MapPin, Cpu, HardDrive, Activity, WifiOff } from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState({ total: 0, active: 0, maintenance: 0, retired: 0 });
  const [monitoring, setMonitoring] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.get('/equipments/stats');
        setStats(response.data || { total: 0, active: 0, maintenance: 0, retired: 0 });
      } catch (err) {
        console.error('Erro ao buscar estatísticas');
      }
    };
    const fetchMonitoring = async () => {
      try {
        const response = await api.get('/monitoring/summary');
        setMonitoring(response.data?.summary || null);
      } catch (err) {
        console.error('Erro ao buscar monitoramento');
      }
    };
    fetchStats();
    fetchMonitoring();
  }, []);

  const cards = [
    { title: 'Total de Ativos', value: stats?.total ?? 0, icon: Package, color: 'var(--primary-gold)' },
    { title: 'Em Operação', value: stats?.active ?? 0, icon: CheckCircle, color: 'var(--accent-emerald)' },
    { title: 'Em Manutenção', value: stats?.maintenance ?? 0, icon: AlertTriangle, color: 'var(--accent-orange)' },
    { title: 'Desativados', value: stats?.retired ?? 0, icon: XCircle, color: 'var(--accent-red)' },
  ];

  return (
    <div className="animate-fade">
      <div style={{ marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '2.25rem', fontWeight: 800, color: '#fff', marginBottom: '0.5rem', letterSpacing: '-1px' }}>
          Dashboard <span style={{ color: 'var(--primary-gold)' }}>Analítico</span>
        </h1>
        <p style={{ fontSize: '1.1rem', fontWeight: 500, color: 'var(--text-light)' }}>
          Gestão e monitoramento em tempo real do parque tecnológico.
        </p>
      </div>

      <div className="kpi-grid">
        {cards.map((card, i) => (
          <div key={i} className="dash-card">
            <div className="dash-card-icon" style={{ background: `${card.color}15`, color: card.color }}>
              <card.icon size={32} strokeWidth={2.5} />
            </div>
            <div className="dash-card-value">{card.value}</div>
            <div className="dash-card-label">{card.title}</div>
            <ArrowUpRight size={16} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', opacity: 0.3 }} />
          </div>
        ))}
      </div>

      {/* Resumo de Monitoramento */}
      <div style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem' }}>
          <Activity size={18} color="var(--primary-gold)" />
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', margin: 0 }}>Monitoramento de Performance</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem' }}>
          {[
            { label: 'CPU Alta', value: monitoring?.cpu_alta ?? '—', icon: Cpu, color: '#ef4444' },
            { label: 'RAM Alta', value: monitoring?.ram_alta ?? '—', icon: Activity, color: '#f59e0b' },
            { label: 'Disco Crítico', value: monitoring?.disco_critico ?? '—', icon: HardDrive, color: '#ef4444' },
            { label: 'Sem Coleta', value: monitoring?.sem_coleta ?? '—', icon: WifiOff, color: '#94a3b8' },
            { label: 'Alertas Ativos', value: monitoring?.alertas_ativos ?? '—', icon: AlertTriangle, color: 'var(--accent-emerald)' },
          ].map((item, i) => (
            <div key={i} className="glass-panel" style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid var(--border-glass)' }}>
              <div style={{ background: `${item.color}18`, padding: '10px', borderRadius: '10px', color: item.color, flexShrink: 0 }}>
                <item.icon size={20} />
              </div>
              <div>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#fff', lineHeight: 1 }}>{item.value}</div>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-light)', letterSpacing: '0.5px', marginTop: '4px' }}>{item.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.2fr', gap: '2.5rem' }}>
        <div className="glass-panel" style={{ padding: '2.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff' }}>Atividade Recente</h2>
            <button className="btn-outline-premium" style={{ height: '36px', fontSize: '0.75rem' }}>Ver Histórico</button>
          </div>
          
          <div style={{ 
            height: '340px', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.1)',
            borderRadius: '20px',
            border: '2px dashed var(--border-glass)'
          }}>
            <Clock size={48} style={{ color: 'rgba(255,255,255,0.05)', marginBottom: '1.5rem' }} />
            <p style={{ color: 'var(--text-light)', fontWeight: 600, fontSize: '0.9rem' }}>Nenhuma movimentação registrada nas últimas 24h.</p>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '2.5rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff', marginBottom: '2.5rem' }}>Localizações</h2>
          <div style={{ spaceY: '1.5rem' }}>
            {['Matriz', 'Filial A', 'Home Office', 'Estoque'].map((loc, i) => (
              <div key={loc} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '1rem', 
                padding: '1.25rem', 
                background: 'rgba(255,255,255,0.02)', 
                borderRadius: '16px',
                marginBottom: '1rem',
                border: '1px solid var(--border-glass)'
              }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <MapPin size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ color: '#fff', fontWeight: 700, margin: 0 }}>{loc}</p>
                  <p style={{ color: 'var(--text-light)', fontSize: '0.75rem', fontWeight: 600, margin: 0 }}>{Math.floor(Math.random() * 20)} ativos alocados</p>
                </div>
                <div style={{ fontWeight: 800, color: 'var(--primary-gold)' }}>{(i + 1) * 15}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
