import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { BookOpen, Edit3, FileText, Plus, Save, Search, Trash2, X } from 'lucide-react';
import api from '../services/api';

const emptyForm = {
  id: null,
  title: '',
  category: 'Geral',
  summary: '',
  content: '',
  audience: 'interno_goldtech',
  status: 'rascunho'
};

const categories = ['Geral', 'Windows', 'Rede', 'Seguranca', 'Email', 'Backup', 'Impressoras', 'Procedimentos'];

export default function KnowledgeBase() {
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = currentUser.role === 'admin';
  const [articles, setArticles] = useState([]);
  const [filters, setFilters] = useState({ q: '', category: '', status: '', audience: '' });
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isAdmin) fetchArticles();
  }, [filters.category, filters.status, filters.audience]);

  const fetchArticles = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.q.trim()) params.q = filters.q.trim();
      if (filters.category) params.category = filters.category;
      if (filters.status) params.status = filters.status;
      if (filters.audience) params.audience = filters.audience;
      const { data } = await api.get('/knowledge/articles', { params });
      setArticles(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Erro ao carregar artigos.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => setForm(emptyForm);

  const editArticle = (article) => {
    setForm({
      id: article.id,
      title: article.title || '',
      category: article.category || 'Geral',
      summary: article.summary || '',
      content: article.content || '',
      audience: article.audience || 'interno_goldtech',
      status: article.status || 'rascunho'
    });
  };

  const saveArticle = async (event) => {
    event.preventDefault();

    if (!form.title.trim() || !form.content.trim()) {
      toast.error('Titulo e conteudo sao obrigatorios.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: form.title,
        category: form.category,
        summary: form.summary,
        content: form.content,
        audience: form.audience,
        status: form.status
      };

      if (form.id) {
        await api.put(`/knowledge/articles/${form.id}`, payload);
        toast.success('Artigo atualizado.');
      } else {
        await api.post('/knowledge/articles', payload);
        toast.success('Artigo criado.');
      }

      resetForm();
      fetchArticles();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Erro ao salvar artigo.');
    } finally {
      setSaving(false);
    }
  };

  const deleteArticle = async (article) => {
    if (!confirm(`Remover "${article.title}"?`)) return;

    try {
      await api.delete(`/knowledge/articles/${article.id}`);
      toast.success('Artigo removido.');
      if (form.id === article.id) resetForm();
      fetchArticles();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Erro ao remover artigo.');
    }
  };

  if (!isAdmin) {
    return (
      <div className="animate-fade-in">
        <div className="page-header">
          <div>
            <h1>Base de Conhecimento</h1>
            <p>Conteudos padroes e orientacoes operacionais.</p>
          </div>
        </div>
        <div className="glass-panel" style={{ padding: '2rem', color: 'var(--text-muted)' }}>
          Acesso restrito aos administradores GoldTech nesta fase.
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1>Base de Conhecimento</h1>
          <p>Artigos padroes, sem informacoes especificas de clientes.</p>
        </div>
        <button className="btn-primary" onClick={resetForm}>
          <Plus size={18} /> Novo artigo
        </button>
      </div>

      <div className="intranet-layout">
        <section>
          <form onSubmit={(event) => { event.preventDefault(); fetchArticles(); }} className="glass-panel" style={{ padding: '1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 150px 170px auto', gap: '0.75rem', alignItems: 'end' }}>
              <div>
                <label className="form-label">Busca</label>
                <div style={{ position: 'relative' }}>
                  <Search size={17} style={{ position: 'absolute', left: 12, top: 13, color: 'var(--text-muted)' }} />
                  <input
                    className="form-control-premium"
                    style={{ paddingLeft: 38 }}
                    value={filters.q}
                    onChange={e => setFilters({ ...filters, q: e.target.value })}
                    placeholder="Windows, VPN, backup..."
                  />
                </div>
              </div>
              <div>
                <label className="form-label">Categoria</label>
                <select className="form-control-premium" value={filters.category} onChange={e => setFilters({ ...filters, category: e.target.value })}>
                  <option value="">Todas</option>
                  {categories.map(category => <option key={category} value={category}>{category}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Status</label>
                <select className="form-control-premium" value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}>
                  <option value="">Todos</option>
                  <option value="rascunho">Rascunho</option>
                  <option value="publicado">Publicado</option>
                </select>
              </div>
              <div>
                <label className="form-label">Publico</label>
                <select className="form-control-premium" value={filters.audience} onChange={e => setFilters({ ...filters, audience: e.target.value })}>
                  <option value="">Todos</option>
                  <option value="interno_goldtech">Interno</option>
                  <option value="visivel_cliente">Cliente</option>
                </select>
              </div>
              <button className="btn-secondary" type="submit">
                <Search size={17} /> Buscar
              </button>
            </div>
          </form>

          {loading ? (
            <div className="glass-panel" style={{ padding: '2rem', color: 'var(--text-light)' }}>Carregando artigos...</div>
          ) : articles.length === 0 ? (
            <div className="glass-panel" style={{ padding: '2rem', color: 'var(--text-muted)' }}>Nenhum artigo cadastrado.</div>
          ) : (
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {articles.map(article => (
                <article key={article.id} className="glass-panel" style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.65rem' }}>
                        <span className="status-badge status-active">{article.category || 'Geral'}</span>
                        <span className="status-badge" style={{
                          color: article.status === 'publicado' ? 'var(--accent-emerald)' : 'var(--accent-orange)',
                          border: '1px solid var(--border-glass)',
                          background: 'rgba(255,255,255,0.04)'
                        }}>
                          {article.status === 'publicado' ? 'Publicado' : 'Rascunho'}
                        </span>
                        <span className="status-badge" style={{ color: 'var(--primary-gold)', border: '1px solid rgba(212,175,55,0.3)', background: 'rgba(212,175,55,0.1)' }}>
                          {article.audience === 'visivel_cliente' ? 'Cliente' : 'Interno'}
                        </span>
                      </div>
                      <h2 style={{ margin: 0, color: '#fff', fontSize: '1rem', fontWeight: 800 }}>{article.title}</h2>
                      {article.summary && (
                        <p style={{ margin: '0.45rem 0 0', color: 'var(--text-light)', lineHeight: 1.5 }}>{article.summary}</p>
                      )}
                      <p style={{ margin: '0.75rem 0 0', color: 'var(--text-muted)', lineHeight: 1.55, whiteSpace: 'pre-wrap', maxHeight: 90, overflow: 'hidden' }}>
                        {article.content}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button className="icon-btn" title="Editar" onClick={() => editArticle(article)}>
                        <Edit3 size={16} />
                      </button>
                      <button className="icon-btn danger" title="Remover" onClick={() => deleteArticle(article)}>
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
              <h2 style={{ margin: 0, color: '#fff', fontSize: '1rem' }}>{form.id ? 'Editar artigo' : 'Novo artigo'}</h2>
            </div>
            {form.id && (
              <button className="icon-btn" title="Cancelar edicao" onClick={resetForm}>
                <X size={16} />
              </button>
            )}
          </div>

          <form onSubmit={saveArticle} style={{ display: 'grid', gap: '0.85rem' }}>
            <div>
              <label className="form-label">Titulo</label>
              <input className="form-control-premium" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ex: Como configurar Outlook" />
            </div>

            <div>
              <label className="form-label">Resumo</label>
              <input className="form-control-premium" value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} placeholder="Breve descricao do artigo" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label className="form-label">Categoria</label>
                <select className="form-control-premium" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  {categories.map(category => <option key={category} value={category}>{category}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Status</label>
                <select className="form-control-premium" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  <option value="rascunho">Rascunho</option>
                  <option value="publicado">Publicado</option>
                </select>
              </div>
            </div>

            <div>
              <label className="form-label">Publico</label>
              <select className="form-control-premium" value={form.audience} onChange={e => setForm({ ...form, audience: e.target.value })}>
                <option value="interno_goldtech">Interno GoldTech</option>
                <option value="visivel_cliente">Visivel para cliente</option>
              </select>
            </div>

            <div>
              <label className="form-label">Conteudo</label>
              <textarea
                className="form-control-premium"
                value={form.content}
                onChange={e => setForm({ ...form, content: e.target.value })}
                rows={10}
                placeholder={'Passo 1: ...\nPasso 2: ...\nObservacoes: ...'}
                style={{ resize: 'vertical', lineHeight: 1.5, minHeight: 220, paddingTop: '1rem' }}
              />
            </div>

            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.78rem', display: 'flex', gap: '0.45rem', alignItems: 'flex-start' }}>
              <FileText size={15} /> Nao inclua nomes, IPs ou dados especificos de clientes aqui.
            </p>

            <button className="btn-primary" type="submit" disabled={saving}>
              <Save size={18} /> {saving ? 'Salvando...' : 'Salvar artigo'}
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
}
