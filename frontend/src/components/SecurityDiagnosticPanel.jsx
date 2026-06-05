import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Download, Eye, FileJson, Loader, Package, RefreshCw, Save, Settings, Trash2, Upload, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

const defaultConfig = {
  scanner_version: '0.1',
  mode: 'single',
  allowlist_json: '[]',
  sensitive_processes_json: '[]',
  notes: '',
};

const fieldStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
};

const labelStyle = {
  color: 'var(--text-light)',
  fontSize: '0.72rem',
  fontWeight: 800,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
};

const inputStyle = {
  width: '100%',
  height: '48px',
  padding: '0 1rem',
  borderRadius: '12px',
  border: '1px solid var(--border-glass)',
  background: 'rgba(0,0,0,0.22)',
  color: '#fff',
  outline: 'none',
  fontSize: '0.92rem',
};

const textareaStyle = {
  ...inputStyle,
  height: 'auto',
  minHeight: '112px',
  padding: '0.85rem 1rem',
  resize: 'vertical',
  lineHeight: 1.6,
  fontFamily: 'inherit',
};

const actionButtonStyle = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  fontWeight: 800,
};

function parseJsonList(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function textToList(text) {
  return text
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(String(value).replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('pt-BR');
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getPackageField(pkg, names, fallback = '-') {
  for (const name of names) {
    if (pkg?.[name] !== undefined && pkg?.[name] !== null && pkg?.[name] !== '') {
      return pkg[name];
    }
  }
  return fallback;
}

function formatJson(value) {
  if (!value) return '-';
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  return JSON.stringify(value, null, 2);
}

function getRiskStyle(riskLevel) {
  const risk = String(riskLevel || '').toLowerCase();
  if (['critical', 'critico', 'crítico', 'high', 'alto'].includes(risk)) {
    return { color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.1)' };
  }
  if (['medium', 'medio', 'médio', 'moderate'].includes(risk)) {
    return { color: 'var(--accent-orange)', border: '1px solid rgba(245,158,11,0.25)', background: 'rgba(245,158,11,0.1)' };
  }
  if (['low', 'baixo'].includes(risk)) {
    return { color: 'var(--accent-emerald)', border: '1px solid rgba(16,185,129,0.25)', background: 'rgba(16,185,129,0.1)' };
  }
  return { color: 'var(--text-light)', border: '1px solid var(--border-glass)', background: 'rgba(255,255,255,0.04)' };
}

export default function SecurityDiagnosticPanel({ clientId, clientName }) {
  const [config, setConfig] = useState(defaultConfig);
  const [allowlistText, setAllowlistText] = useState('');
  const [sensitiveProcessesText, setSensitiveProcessesText] = useState('');
  const [packages, setPackages] = useState([]);
  const [results, setResults] = useState([]);
  const [resultFile, setResultFile] = useState(null);
  const [selectedResult, setSelectedResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [loadingResults, setLoadingResults] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [uploadingResult, setUploadingResult] = useState(false);
  const [viewingResultId, setViewingResultId] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [downloadingResultId, setDownloadingResultId] = useState(null);
  const [deletingResultId, setDeletingResultId] = useState(null);
  const resultFileInputRef = useRef(null);

  const clientLabel = useMemo(() => clientName || `cliente ${clientId}`, [clientId, clientName]);

  const applyConfig = (data = {}) => {
    const next = {
      ...defaultConfig,
      ...data,
      scanner_version: data.scanner_version || data.scannerVersion || defaultConfig.scanner_version,
      mode: data.mode || defaultConfig.mode,
      notes: data.notes || '',
    };

    setConfig(next);
    setAllowlistText(parseJsonList(data.allowlist_json ?? data.allowlist ?? next.allowlist_json).join('\n'));
    setSensitiveProcessesText(
      parseJsonList(data.sensitive_processes_json ?? data.sensitive_processes ?? next.sensitive_processes_json).join('\n')
    );
  };

  const loadConfig = useCallback(async () => {
    const { data } = await api.get(`/clients/${clientId}/security-diagnostic/config`);
    applyConfig(data);
  }, [clientId]);

  const loadPackages = useCallback(async () => {
    setLoadingPackages(true);
    try {
      const { data } = await api.get(`/clients/${clientId}/security-diagnostic/packages`);
      setPackages(Array.isArray(data) ? data : data?.packages || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro ao carregar pacotes gerados.');
    } finally {
      setLoadingPackages(false);
    }
  }, [clientId]);

  const loadResults = useCallback(async () => {
    setLoadingResults(true);
    try {
      const { data } = await api.get(`/clients/${clientId}/security-diagnostic/results`);
      setResults(Array.isArray(data) ? data : data?.results || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro ao carregar resultados enviados.');
    } finally {
      setLoadingResults(false);
    }
  }, [clientId]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    Promise.allSettled([loadConfig(), loadPackages(), loadResults()]).finally(() => {
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, [loadConfig, loadPackages, loadResults]);

  const buildPayload = () => ({
    scanner_version: config.scanner_version || '0.1',
    mode: config.mode === 'baseline' ? 'baseline' : 'single',
    allowlist_json: JSON.stringify(textToList(allowlistText)),
    sensitive_processes_json: JSON.stringify(textToList(sensitiveProcessesText)),
    notes: config.notes || '',
  });

  const saveConfig = async ({ silent = false } = {}) => {
    if (!silent) setSaving(true);
    try {
      const payload = buildPayload();
      const { data } = await api.put(`/clients/${clientId}/security-diagnostic/config`, payload);
      applyConfig(data || payload);
      if (!silent) toast.success('Configuracao do scanner salva com sucesso.');
      return true;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro ao salvar configuracao do scanner.');
      return false;
    } finally {
      if (!silent) setSaving(false);
    }
  };

  const handleGeneratePackage = async () => {
    setGenerating(true);
    const toastId = toast.loading(`Gerando pacote ZIP para ${clientLabel}...`);
    try {
      const saved = await saveConfig({ silent: true });
      if (!saved) {
        toast.dismiss(toastId);
        return;
      }

      await api.post(`/clients/${clientId}/security-diagnostic/packages`);
      await loadPackages();
      toast.success('Pacote ZIP gerado com sucesso.', { id: toastId });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro ao gerar pacote ZIP.', { id: toastId });
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (pkg) => {
    const packageId = getPackageField(pkg, ['id', 'package_id']);
    const filename = getPackageField(pkg, ['filename', 'file_name', 'name'], 'scanner.zip');

    setDownloadingId(packageId);
    try {
      const { data } = await api.get(
        `/clients/${clientId}/security-diagnostic/packages/${packageId}/download`,
        { responseType: 'blob' }
      );

      const url = window.URL.createObjectURL(new Blob([data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Download do pacote iniciado.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro ao baixar pacote ZIP.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (pkg) => {
    const packageId = getPackageField(pkg, ['id', 'package_id']);
    const filename = getPackageField(pkg, ['filename', 'file_name', 'name'], 'pacote selecionado');

    if (!window.confirm(`Excluir o pacote "${filename}"?`)) return;

    setDeletingId(packageId);
    try {
      await api.delete(`/clients/${clientId}/security-diagnostic/packages/${packageId}`);
      await loadPackages();
      toast.success('Pacote excluido com sucesso.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro ao excluir pacote.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleResultFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    if (file && !file.name.toLowerCase().endsWith('.json')) {
      toast.error('Selecione um arquivo .json valido.');
      event.target.value = '';
      setResultFile(null);
      return;
    }

    setResultFile(file);
  };

  const clearResultFile = () => {
    setResultFile(null);
    if (resultFileInputRef.current) {
      resultFileInputRef.current.value = '';
    }
  };

  const handleUploadResult = async () => {
    if (!resultFile) {
      toast.error('Selecione um arquivo JSON antes de enviar.');
      return;
    }

    if (!resultFile.name.toLowerCase().endsWith('.json')) {
      toast.error('Apenas arquivos .json sao aceitos.');
      return;
    }

    const formData = new FormData();
    formData.append('file', resultFile);

    setUploadingResult(true);
    const toastId = toast.loading('Enviando resultado JSON...');
    try {
      await api.post(`/clients/${clientId}/security-diagnostic/results/upload`, formData);
      clearResultFile();
      await loadResults();
      toast.success('Resultado JSON enviado com sucesso.', { id: toastId });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro ao enviar resultado JSON.', { id: toastId });
    } finally {
      setUploadingResult(false);
    }
  };

  const handleViewResult = async (result) => {
    const resultId = getPackageField(result, ['id', 'result_id']);

    setViewingResultId(resultId);
    try {
      const { data } = await api.get(`/clients/${clientId}/security-diagnostic/results/${resultId}`);
      setSelectedResult(data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro ao carregar detalhes do resultado.');
    } finally {
      setViewingResultId(null);
    }
  };

  const handleDownloadResult = async (result) => {
    const resultId = getPackageField(result, ['id', 'result_id']);
    const filename = getPackageField(result, ['original_filename', 'filename', 'file_name'], 'resultado-diagnostico.json');

    setDownloadingResultId(resultId);
    try {
      const { data } = await api.get(
        `/clients/${clientId}/security-diagnostic/results/${resultId}/download`,
        { responseType: 'blob' }
      );

      const url = window.URL.createObjectURL(new Blob([data], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Download do resultado iniciado.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro ao baixar resultado JSON.');
    } finally {
      setDownloadingResultId(null);
    }
  };

  const handleDeleteResult = async (result) => {
    const resultId = getPackageField(result, ['id', 'result_id']);
    const filename = getPackageField(result, ['original_filename', 'filename', 'file_name'], 'resultado selecionado');

    if (!window.confirm(`Excluir o resultado "${filename}"?`)) return;

    setDeletingResultId(resultId);
    try {
      await api.delete(`/clients/${clientId}/security-diagnostic/results/${resultId}`);
      if (selectedResult?.id === resultId) {
        setSelectedResult(null);
      }
      await loadResults();
      toast.success('Resultado excluido com sucesso.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erro ao excluir resultado.');
    } finally {
      setDeletingResultId(null);
    }
  };

  return (
    <div className="content-stack">
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
          <div style={{ color: 'var(--primary-gold)', background: 'rgba(212,175,55,0.1)', padding: '8px', borderRadius: '10px' }}>
            <Settings size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', margin: 0 }}>Configuracao do Scanner</h3>
            <p style={{ color: 'var(--text-light)', fontSize: '0.82rem', margin: '4px 0 0' }}>
              Goldtech Network Behavior Scanner para {clientLabel}
            </p>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-light)' }}>
            <Loader className="animate-spin" size={22} /> Carregando configuracao...
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <div style={fieldStyle}>
                <label style={labelStyle}>Versao do Scanner</label>
                <input
                  style={inputStyle}
                  value={config.scanner_version}
                  onChange={(event) => setConfig((prev) => ({ ...prev, scanner_version: event.target.value }))}
                  placeholder="0.1"
                />
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>Modo de Execucao</label>
                <select
                  style={inputStyle}
                  value={config.mode}
                  onChange={(event) => setConfig((prev) => ({ ...prev, mode: event.target.value }))}
                >
                  <option value="single">single</option>
                  <option value="baseline">baseline</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <div style={fieldStyle}>
                <label style={labelStyle}>Allowlist</label>
                <textarea
                  style={textareaStyle}
                  value={allowlistText}
                  onChange={(event) => setAllowlistText(event.target.value)}
                  placeholder={'Um item por linha\nEx: 443\nEx: 192.168.0.1'}
                />
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>Processos Sensiveis Adicionais</label>
                <textarea
                  style={textareaStyle}
                  value={sensitiveProcessesText}
                  onChange={(event) => setSensitiveProcessesText(event.target.value)}
                  placeholder={'Um item por linha\nEx: nmap\nEx: psexec'}
                />
              </div>
            </div>

            <div style={{ ...fieldStyle, marginBottom: '1.5rem' }}>
              <label style={labelStyle}>Observacoes</label>
              <textarea
                style={{ ...textareaStyle, minHeight: '84px' }}
                value={config.notes || ''}
                onChange={(event) => setConfig((prev) => ({ ...prev, notes: event.target.value }))}
                placeholder="Observacoes sobre a configuracao deste cliente."
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button className="btn-outline-premium" onClick={() => saveConfig()} disabled={saving || generating} style={{ height: '42px', padding: '0 1rem' }}>
                {saving ? <Loader className="animate-spin" size={16} /> : <Save size={16} />}
                Salvar configuracao
              </button>
              <button className="btn-premium" onClick={handleGeneratePackage} disabled={saving || generating} style={{ height: '42px', padding: '0 1rem' }}>
                {generating ? <Loader className="animate-spin" size={16} /> : <Package size={16} />}
                Gerar pacote ZIP
              </button>
            </div>
          </>
        )}
      </div>

      <div className="glass-panel" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
          <div style={{ color: 'var(--accent-blue)', background: 'rgba(59,130,246,0.1)', padding: '8px', borderRadius: '10px' }}>
            <Package size={20} />
          </div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', margin: 0 }}>Pacotes Gerados</h3>
          <button
            onClick={loadPackages}
            disabled={loadingPackages}
            title="Atualizar lista"
            style={{ marginLeft: 'auto', ...actionButtonStyle, color: 'var(--text-light)' }}
          >
            <RefreshCw className={loadingPackages ? 'animate-spin' : ''} size={16} />
            Atualizar
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="table-enterprise">
            <thead>
              <tr>
                <th>Data</th>
                <th>Versao</th>
                <th>Modo</th>
                <th>Nome do arquivo</th>
                <th>SHA256</th>
                <th>Tamanho</th>
                <th>Gerado por</th>
                <th style={{ textAlign: 'right' }}>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {loadingPackages ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-light)' }}>
                    Carregando pacotes...
                  </td>
                </tr>
              ) : packages.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-light)' }}>
                    Nenhum pacote ZIP gerado para este cliente.
                  </td>
                </tr>
              ) : (
                packages.map((pkg) => {
                  const packageId = getPackageField(pkg, ['id', 'package_id']);
                  const filename = getPackageField(pkg, ['filename', 'file_name', 'name']);
                  const sha256 = getPackageField(pkg, ['sha256', 'checksum_sha256']);

                  return (
                    <tr key={packageId}>
                      <td>{formatDate(getPackageField(pkg, ['created_at', 'createdAt', 'generated_at']))}</td>
                      <td>{getPackageField(pkg, ['scanner_version', 'scannerVersion'], config.scanner_version)}</td>
                      <td>{getPackageField(pkg, ['mode'], '-')}</td>
                      <td style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={filename}>
                        {filename}
                      </td>
                      <td>
                        <code title={sha256} style={{ color: 'var(--text-light)', fontSize: '0.72rem' }}>
                          {sha256 && sha256 !== '-' ? sha256 : '-'}
                        </code>
                      </td>
                      <td>{formatBytes(getPackageField(pkg, ['size_bytes', 'sizeBytes', 'size'], 0))}</td>
                      <td>{getPackageField(pkg, ['generated_by', 'generatedBy', 'created_by'], '-')}</td>
                      <td>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                          <button
                            onClick={() => handleDownload(pkg)}
                            disabled={downloadingId === packageId}
                            title="Baixar pacote"
                            style={{ ...actionButtonStyle, color: 'var(--accent-blue)' }}
                          >
                            {downloadingId === packageId ? <Loader className="animate-spin" size={16} /> : <Download size={16} />}
                            Baixar
                          </button>
                          <button
                            onClick={() => handleDelete(pkg)}
                            disabled={deletingId === packageId}
                            title="Excluir pacote"
                            style={{ ...actionButtonStyle, color: 'var(--accent-red)' }}
                          >
                            {deletingId === packageId ? <Loader className="animate-spin" size={16} /> : <Trash2 size={16} />}
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
          <div style={{ color: 'var(--accent-emerald)', background: 'rgba(16,185,129,0.1)', padding: '8px', borderRadius: '10px' }}>
            <FileJson size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', margin: 0 }}>Resultados Enviados</h3>
            <p style={{ color: 'var(--text-light)', fontSize: '0.82rem', margin: '4px 0 0' }}>
              Upload manual do JSON gerado pelo Goldtech Network Behavior Scanner.
            </p>
          </div>
          <button
            onClick={loadResults}
            disabled={loadingResults}
            title="Atualizar resultados"
            style={{ marginLeft: 'auto', ...actionButtonStyle, color: 'var(--text-light)' }}
          >
            <RefreshCw className={loadingResults ? 'animate-spin' : ''} size={16} />
            Atualizar
          </button>
        </div>

        <div style={{ border: '1px solid rgba(245,158,11,0.25)', background: 'rgba(245,158,11,0.05)', borderRadius: '16px', padding: '1rem', marginBottom: '1.5rem' }}>
          <p style={{ color: 'var(--text-light)', lineHeight: 1.7, margin: 0 }}>
            O envio do JSON é manual. Nesta fase, o sistema apenas armazena o resultado e exibe metadados básicos.
            O diagnóstico não confirma infecção, invasão ou malware; ele aponta indícios e itens que exigem validação técnica.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) auto', gap: '12px', alignItems: 'end', marginBottom: '1.5rem' }}>
          <div style={fieldStyle}>
            <label style={labelStyle}>Arquivo JSON do Scanner</label>
            <input
              ref={resultFileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleResultFileChange}
              style={{ ...inputStyle, padding: '11px 1rem' }}
            />
            {resultFile && (
              <span style={{ color: 'var(--text-light)', fontSize: '0.82rem' }}>
                Selecionado: {resultFile.name} ({formatBytes(resultFile.size)})
              </span>
            )}
          </div>
          <button
            className="btn-premium"
            onClick={handleUploadResult}
            disabled={uploadingResult || !resultFile}
            style={{ height: '48px', padding: '0 1rem', whiteSpace: 'nowrap' }}
          >
            {uploadingResult ? <Loader className="animate-spin" size={16} /> : <Upload size={16} />}
            Enviar resultado JSON
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="table-enterprise">
            <thead>
              <tr>
                <th>Data upload</th>
                <th>Host</th>
                <th>Versão</th>
                <th>Modo</th>
                <th>Risco</th>
                <th>Score</th>
                <th>Arquivo</th>
                <th>Tamanho</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loadingResults ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-light)' }}>
                    Carregando resultados enviados...
                  </td>
                </tr>
              ) : results.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-light)' }}>
                    Nenhum resultado JSON enviado para este cliente.
                  </td>
                </tr>
              ) : (
                results.map((result) => {
                  const resultId = getPackageField(result, ['id', 'result_id']);
                  const filename = getPackageField(result, ['original_filename', 'filename', 'file_name']);
                  const riskLevel = getPackageField(result, ['risk_level', 'riskLevel'], '-');
                  const riskStyle = getRiskStyle(riskLevel);

                  return (
                    <tr key={resultId}>
                      <td>{formatDate(getPackageField(result, ['created_at', 'createdAt', 'uploaded_at']))}</td>
                      <td>{getPackageField(result, ['host_name', 'hostName', 'host'], '-')}</td>
                      <td>{getPackageField(result, ['scanner_version', 'scannerVersion'], '-')}</td>
                      <td>{getPackageField(result, ['mode'], '-')}</td>
                      <td>
                        <span className="status-badge" style={riskStyle}>
                          {riskLevel}
                        </span>
                      </td>
                      <td>{getPackageField(result, ['risk_score', 'riskScore', 'score'], '-')}</td>
                      <td style={{ maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={filename}>
                        {filename}
                      </td>
                      <td>{formatBytes(getPackageField(result, ['size_bytes', 'sizeBytes', 'size'], 0))}</td>
                      <td>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                          <button
                            onClick={() => handleViewResult(result)}
                            disabled={viewingResultId === resultId}
                            title="Visualizar resultado"
                            style={{ ...actionButtonStyle, color: 'var(--primary-gold)' }}
                          >
                            {viewingResultId === resultId ? <Loader className="animate-spin" size={16} /> : <Eye size={16} />}
                            Visualizar
                          </button>
                          <button
                            onClick={() => handleDownloadResult(result)}
                            disabled={downloadingResultId === resultId}
                            title="Baixar JSON"
                            style={{ ...actionButtonStyle, color: 'var(--accent-blue)' }}
                          >
                            {downloadingResultId === resultId ? <Loader className="animate-spin" size={16} /> : <Download size={16} />}
                            Baixar
                          </button>
                          <button
                            onClick={() => handleDeleteResult(result)}
                            disabled={deletingResultId === resultId}
                            title="Excluir resultado"
                            style={{ ...actionButtonStyle, color: 'var(--accent-red)' }}
                          >
                            {deletingResultId === resultId ? <Loader className="animate-spin" size={16} /> : <Trash2 size={16} />}
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '2rem', borderLeft: '4px solid var(--accent-orange)', background: 'rgba(245,158,11,0.05)' }}>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
          <div style={{ color: 'var(--accent-orange)', background: 'rgba(245,158,11,0.12)', padding: '10px', borderRadius: '12px', flexShrink: 0 }}>
            <AlertTriangle size={22} />
          </div>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#fff', margin: '0 0 10px' }}>Aviso Operacional</h3>
            <p style={{ color: 'var(--text-light)', lineHeight: 1.7, margin: 0 }}>
              Este diagnostico nao e antivirus e nao confirma infeccao ou invasao. O scanner identifica exposicao de rede,
              conexoes incomuns, portas em escuta, processos sensiveis e anomalias em relacao ao baseline. A execucao deve
              ser feita manualmente no ambiente do cliente por um tecnico autorizado. Nesta fase, os resultados ainda nao
              sao enviados automaticamente ao Inventario.
            </p>
          </div>
        </div>
      </div>

      {selectedResult && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            zIndex: 1200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            backdropFilter: 'blur(4px)'
          }}
        >
          <div
            className="glass-panel animate-scale"
            style={{
              width: '100%',
              maxWidth: '860px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '2rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
              <div style={{ color: 'var(--accent-emerald)', background: 'rgba(16,185,129,0.1)', padding: '8px', borderRadius: '10px' }}>
                <FileJson size={20} />
              </div>
              <div>
                <h3 style={{ color: '#fff', fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>Resultado do Scanner</h3>
                <p style={{ color: 'var(--text-light)', margin: '4px 0 0', fontSize: '0.82rem' }}>
                  {getPackageField(selectedResult, ['original_filename', 'filename', 'file_name'])}
                </p>
              </div>
              <button
                onClick={() => setSelectedResult(null)}
                title="Fechar"
                style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'var(--text-light)', cursor: 'pointer' }}
              >
                <X size={22} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '1.5rem' }}>
              {[
                ['Host', getPackageField(selectedResult, ['host_name', 'hostName', 'host'])],
                ['Versão', getPackageField(selectedResult, ['scanner_version', 'scannerVersion'])],
                ['Modo', getPackageField(selectedResult, ['mode'])],
                ['Risco', getPackageField(selectedResult, ['risk_level', 'riskLevel'])],
                ['Score', getPackageField(selectedResult, ['risk_score', 'riskScore', 'score'])],
                ['Data da coleta', formatDate(getPackageField(selectedResult, ['collected_at', 'collectedAt']))],
              ].map(([label, value]) => (
                <div key={label} style={{ border: '1px solid var(--border-glass)', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', padding: '1rem' }}>
                  <div style={{ ...labelStyle, marginBottom: '8px' }}>{label}</div>
                  <div style={{ color: '#fff', fontWeight: 700, overflowWrap: 'anywhere' }}>{value || '-'}</div>
                </div>
              ))}
            </div>

            <div style={{ ...fieldStyle, marginBottom: '1.5rem' }}>
              <label style={labelStyle}>Hash SHA256</label>
              <code style={{ color: 'var(--text-light)', border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '0.9rem', background: 'rgba(0,0,0,0.22)', overflowWrap: 'anywhere' }}>
                {getPackageField(selectedResult, ['sha256'], '-')}
              </code>
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Resumo JSON</label>
              <pre
                style={{
                  margin: 0,
                  padding: '1rem',
                  borderRadius: '12px',
                  border: '1px solid var(--border-glass)',
                  background: 'rgba(0,0,0,0.3)',
                  color: 'var(--text-light)',
                  maxHeight: '320px',
                  overflow: 'auto',
                  fontSize: '0.82rem',
                  lineHeight: 1.6
                }}
              >
                {formatJson(selectedResult.summary)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
