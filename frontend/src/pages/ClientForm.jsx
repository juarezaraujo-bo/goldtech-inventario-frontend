import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import { ChevronLeft, Save, Building2, Info, MapPin, Phone, Mail, Shield, Loader, Search, CheckCircle, AlertCircle } from 'lucide-react';

export default function ClientForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  
  const [formData, setFormData] = useState({
    name: '',
    cnpj: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    observations: '',
    status: 'Ativo'
  });

  const [loading, setLoading] = useState(false);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cnpjStatus, setCnpjStatus] = useState(null); // null | 'ok' | 'error'

  const fetchCNPJ = async (rawCnpj) => {
    const cnpj = rawCnpj.replace(/\D/g, '');
    if (cnpj.length !== 14) return;

    setCnpjLoading(true);
    setCnpjStatus(null);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
      if (!res.ok) throw new Error('CNPJ não encontrado');
      const d = await res.json();

      // Montar telefone com DDD
      const telefone = d.ddd_telefone_1
        ? d.ddd_telefone_1.replace(/^(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3')
        : '';

      // Montar endereço completo
      const parts = [
        d.logradouro, d.numero, d.complemento, d.bairro,
        d.municipio, d.uf, d.cep ? d.cep.replace(/(\d{5})(\d{3})/, '$1-$2') : ''
      ].filter(Boolean);
      const address = parts.join(', ');

      setFormData(prev => ({
        ...prev,
        name: d.razao_social || d.nome_fantasia || prev.name,
        cnpj: cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5'),
        phone: telefone || prev.phone,
        email: d.email || prev.email,
        address: address || prev.address,
      }));

      setCnpjStatus('ok');
      toast.success('Dados carregados automaticamente via CNPJ', { icon: '🏢' });
    } catch (err) {
      setCnpjStatus('error');
      toast.error('CNPJ não encontrado ou indisponível');
    } finally {
      setCnpjLoading(false);
    }
  };

  useEffect(() => {
    if (isEdit) {
      const fetchData = async () => {
        try {
          const { data } = await api.get(`/clients/${id}`);
          setFormData(data);
        } catch (err) {
          toast.error('Erro ao buscar dados do cliente');
          navigate('/clientes');
        }
      };
      fetchData();
    }
  }, [id, isEdit]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEdit) {
        await api.put(`/clients/${id}`, formData);
        toast.success('Cliente atualizado com sucesso');
      } else {
        await api.post('/clients', formData);
        toast.success('Cliente cadastrado com sucesso');
      }
      navigate('/clientes');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro ao salvar cliente');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="animate-fade">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '3rem' }}>
        <button 
          onClick={() => navigate('/clientes')} 
          style={{ width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)', borderRadius: '14px', color: 'var(--text-light)', cursor: 'pointer' }}
        >
          <ChevronLeft size={24} />
        </button>
        <div>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 800, color: '#fff', margin: 0 }}>{isEdit ? 'Editar Cliente' : 'Novo Cliente'}</h1>
          <p style={{ color: 'var(--text-light)', fontWeight: 600 }}>Cadastre e gerencie as informações institucionais do cliente.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '3rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
          
          <div className="glass-panel" style={{ padding: '2.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2.5rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '1.5rem' }}>
              <Building2 size={24} color="var(--primary-gold)" />
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff' }}>Dados Institucionais</h2>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', gridColumn: '1/-1' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-light)' }}>Razão Social / Nome Fantasia *</label>
                <input type="text" name="name" className="form-control-premium" required value={formData.name} onChange={handleChange} placeholder="Nome da Empresa" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-light)' }}>CNPJ</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    name="cnpj"
                    className="form-control-premium"
                    value={formData.cnpj}
                    onChange={(e) => {
                      handleChange(e);
                      const raw = e.target.value.replace(/\D/g, '');
                      if (raw.length === 14) fetchCNPJ(raw);
                    }}
                    onBlur={(e) => fetchCNPJ(e.target.value)}
                    placeholder="00.000.000/0001-00"
                    style={{ paddingRight: '2.5rem' }}
                  />
                  <div style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)' }}>
                    {cnpjLoading && <Loader size={16} color="var(--primary-gold)" style={{ animation: 'spin 1s linear infinite' }} />}
                    {!cnpjLoading && cnpjStatus === 'ok' && <CheckCircle size={16} color="var(--accent-emerald)" />}
                    {!cnpjLoading && cnpjStatus === 'error' && <AlertCircle size={16} color="var(--accent-red)" />}
                  </div>
                </div>
                {cnpjStatus === 'ok' && (
                  <span style={{ fontSize: '0.65rem', color: 'var(--accent-emerald)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <CheckCircle size={11} /> Dados preenchidos automaticamente
                  </span>
                )}
                {cnpjStatus === 'error' && (
                  <span style={{ fontSize: '0.65rem', color: 'var(--accent-red)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertCircle size={11} /> CNPJ não encontrado ou indisponível
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-light)' }}>Status</label>
                <select name="status" className="form-control-premium" value={formData.status} onChange={handleChange}>
                  <option value="Ativo">Ativo</option>
                  <option value="Inativo">Inativo / Suspenso</option>
                </select>
              </div>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '2.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2.5rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '1.5rem' }}>
              <Phone size={24} color="var(--accent-emerald)" />
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff' }}>Contato e Localização</h2>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-light)' }}>Contato Principal</label>
                <input type="text" name="contact_person" className="form-control-premium" value={formData.contact_person} onChange={handleChange} placeholder="Nome do responsável" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-light)' }}>Telefone</label>
                <input type="text" name="phone" className="form-control-premium" value={formData.phone} onChange={handleChange} placeholder="(00) 00000-0000" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', gridColumn: '1/-1' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-light)' }}>E-mail corporativo</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.2)' }} />
                  <input type="email" name="email" className="form-control-premium" value={formData.email} onChange={handleChange} style={{ paddingLeft: '3.5rem' }} placeholder="contato@empresa.com" />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', gridColumn: '1/-1' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-light)' }}>Endereço Completo</label>
                <div style={{ position: 'relative' }}>
                  <MapPin size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.2)' }} />
                  <input type="text" name="address" className="form-control-premium" value={formData.address} onChange={handleChange} style={{ paddingLeft: '3.5rem' }} placeholder="Rua, Número, Bairro, Cidade - UF" />
                </div>
              </div>
            </div>
            
            <div style={{ marginTop: '2.5rem', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-light)' }}>Observações</label>
              <textarea name="observations" className="form-control-premium" value={formData.observations} onChange={handleChange} style={{ minHeight: '120px', paddingTop: '1rem', resize: 'none' }} placeholder="Informações adicionais sobre o contrato ou cliente..."></textarea>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass-panel" style={{ padding: '2rem', position: 'sticky', top: '2rem' }}>
            <h3 style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '1.5rem' }}>Ações</h3>
            <button type="submit" disabled={loading} className="btn-premium" style={{ width: '100%', height: '56px', fontSize: '1rem', marginBottom: '1rem' }}>
              <Save size={20} />
              <span style={{ marginLeft: '8px' }}>{isEdit ? 'Salvar Cliente' : 'Cadastrar Cliente'}</span>
            </button>
            <button type="button" onClick={() => navigate('/clientes')} className="btn-outline-premium" style={{ width: '100%', height: '56px', fontSize: '1rem' }}>
              Voltar
            </button>
            
            <div style={{ marginTop: '2.5rem', paddingTop: '2rem', borderTop: '1px solid var(--border-glass)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', color: 'var(--primary-gold)' }}>
                <Shield size={16} />
                <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>Privacidade</span>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', lineHeight: 1.6, margin: 0 }}>
                Os dados institucionais são protegidos e acessíveis apenas por administradores do sistema.
              </p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
