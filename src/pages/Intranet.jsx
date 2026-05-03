import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { BookOpen, Building2, Edit3, Plus, Save, Search, ShieldCheck, Trash2, X } from 'lucide-react';
import api from '../services/api';

const emptyForm = {
  id: null,
  client_id: '',
  title: '',
  category: 'Geral',
  content: '',
  visibility: 'interno_goldtech'
};

const categories = ['Geral', 'Rede', 'Impressoras', 'Servidores', 'Sistemas', 'Procedimentos', 'Contatos', 'Observacoes'];

export default function Intranet() {
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = currentUser.role === 'admin';
  const [clients, setClients] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState({ client_id: '', q: '', category: '' });
  const [form, setForm] = useState(emptyForm);

  const selectedClient = useMemo(
    () => clients.find(c => String(c.id) === String(form.client_id)),
    [clients, form.client_id]
  );

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    if (isAdmin) fetchDocuments();
  }, [filters.client_id, filters.category]);

  const fetchClients = async () => {
    try {
      const { data } = await api.get('/clients');
      setClients(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Erro ao carregar clientes.');
    }
  };

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.client_id) params.client_id = filters.client_id;
      if (filters.category) params.category = filters.category;
      if (filters.q.trim()) params.q = filters.q.trim();
      const { data } = await api.get('/intranet/documents', { params });
      setDocuments(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Erro ao carregar documentos.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (event) => {
    event.preventDefault();
    fetchDocuments();
  };

  const resetForm = () => {
    setForm(emptyForm);
  };

  const editDocument = (doc) => {
    setForm({
      id: doc.id,
      client_id: doc.client_id,
      title: doc.title || '',
      category: doc.category || 'Geral',
      content: doc.content || '',
      visibility: doc.visibility || 'interno_goldtech'
    });
  };

  const saveDocument = async (event) => {
    event.preventDefault();

    if (!form.client_id || !form.title.trim() || !form.content.trim()) {
      toast.error('Cliente, titulo e conteudo sao obrigatorios.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        client_id: Number(form.client_id),
        title: form.title,
        category: form.category,
        content: form.content,
        visibility: form.visibility
      };

      if (form.id) {
        await api.put(`/intranet/documents/${form.id}`, payload);
        toast.success('Documento atualizado.');
      } else {
        await api.post('/intranet/documents', payload);
        toast.success('Documento criado.');
      }

      resetForm();
      fetchDocuments();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Erro ao salvar documento.');
    } finally {
      setSaving(false);
    }
  };

  const deleteDocument = async (doc) => {
    if (!confirm(`Remover "${doc.title}"?`)) return;

    try {
      await api.delete(`/intranet/documents/${doc.id}`);
      toast.success('Documento removido.');
      if (form.id === doc.id) resetForm();
      fetchDocuments();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Erro ao remover documento.');
    }
  };

  if (!isAdmin) {
    return (
      <div className="animate-fade-in">
        <div className="page-header">
          <div>
            <h1>Intranet GoldTech</h1>
            <p>Documentacao interna protegida.</p>
          </div>
        </div>
        <div className="glass-panel" style={{ padding: '2rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <ShieldCheck size={28} color="var(--primary-gold)" />
          <div>
            <h2 style={{ margin: 0, color: '#fff', fontSize: '1.1rem' }}>Acesso restrito</h2>
            <p style={{ margin: '0.35rem 0 0', color: 'var(--text-muted)' }}>Somente administradores GoldTech podem acessar a documentacao interna.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1>Intranet GoldTech</h1>
          <p>Documentacao tecnica interna por cliente.</p>
        </div>
        <button className="btn-primary" onClick={resetForm}>
          <Plus size={18} /> Novo documento
        </button>
      </div>

      <div className="intranet-layout">
        <section>
          <form onSubmit={handleSearch} className="glass-panel" style={{ padding: '1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px 180px auto', gap: '0.75rem', alignItems: 'end' }}>
              <div>
                <label className="form-label">Busca</label>
                <div style={{ position: 'relative' }}>
                  <Search size={17} style={{ position: 'absolute', left: 12, top: 13, color: 'var(--text-muted)' }} />
                  <input
                    className="form-control-premium"
                    style={{ paddingLeft: 38 }}
                    value={filters.q}
                    onChange={e => setFilters({ ...filters, q: e.target.value })}
                    placeholder="IP, impressora, procedimento..."
                  />
                </div>
              </div>
              <div>
                <label className="form-label">Cliente</label>
                <select className="form-control-premium" value={filters.client_id} onChange={e => setFilters({ ...filters, client_id: e.target.value })}>
                  <option value="">Todos</option>
                  {clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Categoria</label>
                <select className="form-control-premium" value={filters.category} onChange={e => setFilters({ ...filters, category: e.target.value })}>
                  <option value="">Todas</option>
                  {categories.map(category => <option key={category} value={category}>{category}</option>)}
                </select>
              </div>
              <button className="btn-secondary" type="submit">
                <Search size={17} /> Buscar
              </button>
            </div>
          </form>

          {loading ? (
            <div className="glass-panel" style={{ padding: '2rem', color: 'var(--text-light)' }}>Carregando documentos...</div>
          ) : documents.length === 0 ? (
            <div className="glass-panel" style={{ padding: '2rem', color: 'var(--text-muted)' }}>Nenhum documento interno encontrado.</div>
          ) : (
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {documents.map(doc => (
                <article key={doc.id} className="glass-panel" style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.65rem' }}>
                        <span className="status-badge status-active">{doc.category || 'Geral'}</span>
                        <span className="status-badge" style={{ color: 'var(--primary-gold)', borderColor: 'rgba(212,175,55,0.3)', background: 'rgba(212,175,55,0.1)' }}>
                          {doc.visibility === 'base_cliente' ? 'Base cliente' : 'Interno GoldTech'}
                        </span>
                      </div>
                      <h2 style={{ margin: 0, color: '#fff', fontSize: '1rem', fontWeight: 800 }}>{doc.title}</h2>
                      <p style={{ margin: '0.45rem 0 0', color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <Building2 size={14} /> {doc.client_name}
                      </p>
                      <p style={{
                        margin: '0.75rem 0 0',
                        color: 'var(--text-light)',
                        lineHeight: 1.55,
                        whiteSpace: 'pre-wrap',
                        maxHeight: 96,
                        overflow: 'hidden'
                      }}>
                        {doc.content}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button className="icon-btn" title="Editar" onClick={() => editDocument(doc)}>
                        <Edit3 size={16} />
                      </button>
                      <button className="icon-btn danger" title="Remover" onClick={() => deleteDocument(doc)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <aside className="glass-panel" style={{ padding: '1.25rem', position: 'sticky', top: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <BookOpen size={21} color="var(--primary-gold)" />
              <h2 style={{ margin: 0, color: '#fff', fontSize: '1rem' }}>{form.id ? 'Editar documento' : 'Novo documento'}</h2>
            </div>
            {form.id && (
              <button className="icon-btn" title="Cancelar edicao" onClick={resetForm}>
                <X size={16} />
              </button>
            )}
          </div>

          <form onSubmit={saveDocument} style={{ display: 'grid', gap: '0.85rem' }}>
            <div>
              <label className="form-label">Cliente</label>
              <select className="form-control-premium" value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })}>
                <option value="">Selecione</option>
                {clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
              </select>
            </div>

            <div>
              <label className="form-label">Titulo</label>
              <input className="form-control-premium" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ex: Impressora RH" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label className="form-label">Categoria</label>
                <select className="form-control-premium" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  {categories.map(category => <option key={category} value={category}>{category}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Visibilidade</label>
                <select className="form-control-premium" value={form.visibility} onChange={e => setForm({ ...form, visibility: e.target.value })}>
                  <option value="interno_goldtech">Interno</option>
                  <option value="base_cliente">Base cliente</option>
                </select>
              </div>
            </div>

            <div>
              <label className="form-label">Conteudo</label>
              <textarea
                className="form-control-premium"
                value={form.content}
                onChange={e => setForm({ ...form, content: e.target.value })}
                rows={10}
                placeholder={'IP: 192.168.1.45\nLocal: RH\nObservacao: impressora padrao do setor'}
                style={{ resize: 'vertical', lineHeight: 1.5, minHeight: 220, paddingTop: '1rem' }}
              />
            </div>

            {selectedClient && (
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                Este documento sera vinculado ao cliente {selectedClient.name}.
              </p>
            )}

            <button className="btn-primary" type="submit" disabled={saving}>
              <Save size={18} /> {saving ? 'Salvando...' : 'Salvar documento'}
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
}
