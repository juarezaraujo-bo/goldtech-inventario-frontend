import { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import { 
  ChevronLeft, Save, Info, History, Package, Shield, 
  MapPin, Tag, Box, Monitor, Database, ShieldCheck, 
  Cpu, HardDrive, Network, Globe, Activity, Clock, Terminal, AlertTriangle
} from 'lucide-react';
import MaintenanceHistory from '../components/MaintenanceHistory';

export default function EquipmentForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const initialClientId = queryParams.get('client_id');
  const isEdit = Boolean(id);
  
  const [clients, setClients] = useState([]);
  const [isDirty, setIsDirty] = useState(false);
  const [formData, setFormData] = useState({
    client_id: initialClientId || '',
    nome: '',
    categoria: 'Desktops',
    tipo: '',
    fabricante: '',
    modelo: '',
    numero_serie: '',
    patrimonio: '',
    usuario_responsavel: '',
    localizacao: '',
    setor: '',
    status: 'Ativo',
    data_aquisicao: '',
    garantia: '',
    observacoes: '',
    sistema_operacional: '',
    processador: '',
    memoria_ram: '',
    armazenamento: '',
    ip: '',
    mac: '',
    dominio: '',
    antivirus: '',
    ultima_coleta: '',
    origem_cadastro: 'manual',
    disco_livre_gb: '',
    bios_versao: '',
    placa_mae: '',
    data_instalacao_os: '',
    ultima_inicializacao: ''
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        handleGoBack();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isDirty]);

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const { data } = await api.get('/clients');
        setClients(data);
      } catch (err) {
        toast.error('Erro ao carregar clientes');
      }
    };
    
    const fetchEquipment = async () => {
      try {
        const { data } = await api.get(`/equipments/${id}`);
        setFormData(prev => ({ ...prev, ...data }));
        setIsDirty(false); // Reset dirty after fetch
      } catch (err) {
        toast.error('Erro ao carregar dados do equipamento');
        navigate(-1);
      }
    };

    fetchClients();
    if (isEdit) fetchEquipment();
  }, [id, isEdit]);

  const handleGoBack = () => {
    if (isDirty) {
      if (window.confirm('Existem alterações não salvas. Deseja realmente sair?')) {
        navigate(-1);
      }
    } else {
      navigate(-1);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEdit) {
        await api.put(`/equipments/${id}`, formData);
        toast.success('Registro atualizado com sucesso');
      } else {
        await api.post('/equipments', formData);
        toast.success('Equipamento cadastrado com sucesso');
      }
      setIsDirty(false);
      navigate(-1);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro ao processar');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setIsDirty(true);
  };

  return (
    <div className="animate-fade">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '3rem' }}>
        <button 
          onClick={handleGoBack} 
          style={{ width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)', borderRadius: '14px', color: 'var(--text-light)', cursor: 'pointer' }}
        >
          <ChevronLeft size={24} />
        </button>
        <div>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 800, color: '#fff', margin: 0 }}>{isEdit ? 'Editar Ativo' : 'Novo Equipamento'}</h1>
          <p style={{ color: 'var(--text-light)', fontWeight: 600 }}>Configure as informações técnicas e administrativas do ativo.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '3rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
          
          {/* Sessão 1: Identificação */}
          <div className="glass-panel" style={{ padding: '2.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2.5rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '1.5rem' }}>
              <Tag size={24} color="var(--primary-gold)" />
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff' }}>Identificação e Alocação</h2>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', gridColumn: '1/-1' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-light)' }}>Cliente Responsável *</label>
                <select name="client_id" className="form-control-premium" required value={formData.client_id} onChange={handleChange}>
                  <option value="">Selecione um cliente...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-light)' }}>Nome / Hostname *</label>
                <input type="text" name="nome" className="form-control-premium" required value={formData.nome} onChange={handleChange} placeholder="Ex: NB-FIN-01" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-light)' }}>Número de Patrimônio *</label>
                <input type="text" name="patrimonio" className="form-control-premium" required value={formData.patrimonio} onChange={handleChange} placeholder="GT-XXXX" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-light)' }}>Número de Série</label>
                <input type="text" name="numero_serie" className="form-control-premium" value={formData.numero_serie} onChange={handleChange} placeholder="S/N ou Service Tag" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-light)' }}>Categoria *</label>
                <select name="categoria" className="form-control-premium" required value={formData.categoria} onChange={handleChange}>
                  <option value="Desktops">Desktops</option>
                  <option value="Notebooks">Notebooks</option>
                  <option value="Servidores">Servidores</option>
                  <option value="Roteadores">Roteadores</option>
                  <option value="Ativos de Rede">Ativos de Rede</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-light)' }}>Status *</label>
                <select name="status" className="form-control-premium" value={formData.status} onChange={handleChange}>
                  <option value="Ativo">Ativo</option>
                  <option value="Manutenção">Em Manutenção</option>
                  <option value="Desativado">Desativado</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-light)' }}>Usuário Responsável</label>
                <input type="text" name="usuario_responsavel" className="form-control-premium" value={formData.usuario_responsavel} onChange={handleChange} placeholder="Nome do usuário" />
              </div>
            </div>
          </div>

          {/* Sessão 2: Hardware e SO */}
          <div className="glass-panel" style={{ padding: '2.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2.5rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '1.5rem' }}>
              <Monitor size={24} color="var(--accent-emerald)" />
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff' }}>Especificações Técnicas</h2>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-light)' }}>Sistema Operacional</label>
                <input type="text" name="sistema_operacional" className="form-control-premium" value={formData.sistema_operacional} onChange={handleChange} placeholder="Ex: Windows 11 Pro" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-light)' }}>Processador</label>
                <div style={{ position: 'relative' }}>
                  <Cpu size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.2)' }} />
                  <input type="text" name="processador" className="form-control-premium" value={formData.processador} onChange={handleChange} style={{ paddingLeft: '3.5rem' }} placeholder="Intel i7 / Ryzen 7" />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-light)' }}>Memória RAM</label>
                <input type="text" name="memoria_ram" className="form-control-premium" value={formData.memoria_ram} onChange={handleChange} placeholder="Ex: 16GB" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-light)' }}>Armazenamento Total</label>
                <div style={{ position: 'relative' }}>
                  <HardDrive size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.2)' }} />
                  <input type="text" name="armazenamento" className="form-control-premium" value={formData.armazenamento} onChange={handleChange} style={{ paddingLeft: '3.5rem' }} placeholder="512GB SSD" />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-light)' }}>Fabricante / Modelo</label>
                <input type="text" name="fabricante" className="form-control-premium" value={formData.fabricante} onChange={handleChange} placeholder="Fabricante" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-light)' }}>Placa Mãe</label>
                <input type="text" name="placa_mae" className="form-control-premium" value={formData.placa_mae} onChange={handleChange} placeholder="Fabricante e Modelo" />
              </div>
            </div>
          </div>

          {/* Sessão 3: Rede e Segurança */}
          <div className="glass-panel" style={{ padding: '2.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2.5rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '1.5rem' }}>
              <Network size={24} color="var(--accent-blue)" />
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff' }}>Conectividade</h2>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-light)' }}>Endereço IP</label>
                <input type="text" name="ip" className="form-control-premium" value={formData.ip} onChange={handleChange} placeholder="192.168.X.X" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-light)' }}>Endereço MAC</label>
                <input type="text" name="mac" className="form-control-premium" value={formData.mac} onChange={handleChange} placeholder="00:00:00:00:00:00" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-light)' }}>Domínio / Workgroup</label>
                <input type="text" name="dominio" className="form-control-premium" value={formData.dominio} onChange={handleChange} placeholder="goldtech.local" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-light)' }}>Antivírus</label>
                <input type="text" name="antivirus" className="form-control-premium" value={formData.antivirus} onChange={handleChange} placeholder="Endpoint Security" />
              </div>
            </div>
          </div>

          {/* Sessão 4: Dados de Coleta */}
          {isEdit && (
            <div className="glass-panel" style={{ padding: '2.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2.5rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '1.5rem' }}>
                <Terminal size={24} color="var(--primary-gold)" />
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff' }}>Dados de Coleta Automática</h2>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-light)', marginBottom: '4px' }}>BIOS Versão</label>
                  <span style={{ color: '#fff', fontWeight: 700 }}>{formData.bios_versao || 'N/A'}</span>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-light)', marginBottom: '4px' }}>Instalação do SO</label>
                  <span style={{ color: '#fff', fontWeight: 700 }}>{formData.data_instalacao_os || 'N/A'}</span>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-light)', marginBottom: '4px' }}>Último Boot</label>
                  <span style={{ color: '#fff', fontWeight: 700 }}>{formData.ultima_inicializacao || 'N/A'}</span>
                </div>
              </div>
            </div>
          )}
          
          {isEdit && (
            <div className="glass-panel" style={{ padding: '2.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2.5rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '1.5rem' }}>
                <History size={24} color="var(--primary-gold)" />
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff' }}>Histórico de Manutenções</h2>
              </div>
              <MaintenanceHistory equipmentId={id} />
            </div>
          )}
        </div>

        {/* Sidebar Ações */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass-panel" style={{ padding: '2rem', position: 'sticky', top: '2rem' }}>
            <button type="submit" disabled={loading} className="btn-premium" style={{ width: '100%', height: '56px', fontSize: '1rem', marginBottom: '1rem' }}>
              {loading ? <Activity className="animate-spin" size={20} /> : <Save size={20} />}
              <span style={{ marginLeft: '8px' }}>{isEdit ? 'Salvar Alterações' : 'Cadastrar Ativo'}</span>
            </button>
            <button type="button" onClick={handleGoBack} className="btn-outline-premium" style={{ width: '100%', height: '56px', fontSize: '1rem' }}>
              Descartar
            </button>
            
            <div style={{ marginTop: '2.5rem', paddingTop: '2rem', borderTop: '1px solid var(--border-glass)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', color: 'var(--primary-gold)' }}>
                <Shield size={16} />
                <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>Auditoria Goldtech</span>
              </div>
              {isDirty && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-orange)', marginBottom: '1rem' }}>
                  <AlertTriangle size={14} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Alterações não salvas</span>
                </div>
              )}
              <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', lineHeight: 1.6, margin: 0 }}>
                Ao alterar a categoria manualmente, o agente de coleta deixará de reclassificar este equipamento automaticamente.
              </p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
