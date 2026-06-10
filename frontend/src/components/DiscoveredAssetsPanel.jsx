import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckSquare, ExternalLink, HelpCircle, Loader, Network, Printer, RefreshCw, Router, Server, Monitor, Tv } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

const FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'printer', label: 'Impressoras' },
  { key: 'network_device', label: 'Dispositivos de rede' },
  { key: 'media_device', label: 'IoT / Multimídia' },
  { key: 'unknown', label: 'Desconhecidos' }
];

const TYPE_LABELS = {
  workstation: 'Estação',
  server: 'Servidor',
  printer: 'Impressora',
  network_device: 'Dispositivo de rede',
  media_device: 'IoT / Multimídia',
  unknown: 'Desconhecido'
};

const TYPE_ICONS = {
  workstation: Monitor,
  server: Server,
  printer: Printer,
  network_device: Router,
  media_device: Tv,
  unknown: HelpCircle
};

const DOCUMENTATION_STATUS_LABELS = {
  pending: 'Pendente',
  imported: 'Importado',
  updated: 'Atualizado',
  ignored: 'Ignorado'
};

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('pt-BR');
}

function formatPorts(ports) {
  if (!Array.isArray(ports) || ports.length === 0) return '-';
  return ports.join(', ');
}

function getTypeStyle(type) {
  if (type === 'printer') {
    return { color: 'var(--primary-gold)', background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.2)' };
  }
  if (type === 'network_device') {
    return { color: 'var(--accent-blue)', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' };
  }
  if (type === 'server') {
    return { color: 'var(--accent-emerald)', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' };
  }
  if (type === 'media_device') {
    return { color: '#a78bfa', background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.22)' };
  }
  return { color: 'var(--text-light)', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-glass)' };
}

function smallBadgeStyle(color, background, border) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    width: 'fit-content',
    marginTop: '6px',
    padding: '3px 7px',
    borderRadius: '999px',
    color,
    background,
    border,
    fontSize: '0.62rem',
    fontWeight: 900,
    letterSpacing: '0.02em',
    textTransform: 'uppercase'
  };
}

export default function DiscoveredAssetsPanel({ clientId }) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState([]);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [bulkImporting, setBulkImporting] = useState(false);
  const errorToastShownRef = useRef(false);

  const loadAssets = async () => {
    if (!clientId) {
      setAssets([]);
      return;
    }

    setLoading(true);
    try {
      const response = await api.get(`/clients/${clientId}/network-discovered-assets`);
      setAssets(Array.isArray(response.data) ? response.data : []);
      setSelectedIds([]);
      errorToastShownRef.current = false;
    } catch (error) {
      setAssets([]);
      if (error.response?.status === 401) return;
      if (!errorToastShownRef.current) {
        toast.error(error.response?.data?.message || 'Erro ao carregar ativos descobertos.');
        errorToastShownRef.current = true;
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssets();
  }, [clientId]);

  const filteredAssets = useMemo(() => {
    if (filter === 'all') return assets;
    return assets.filter((asset) => asset.device_type === filter);
  }, [assets, filter]);

  const counters = useMemo(() => ({
    all: assets.length,
    printer: assets.filter((asset) => asset.device_type === 'printer').length,
    network_device: assets.filter((asset) => asset.device_type === 'network_device').length,
    media_device: assets.filter((asset) => asset.device_type === 'media_device').length,
    unknown: assets.filter((asset) => asset.device_type === 'unknown').length
  }), [assets]);

  const actionableAssets = filteredAssets.filter((asset) => !['imported', 'updated', 'ignored'].includes(asset.documentation_status));
  const allVisibleSelected = actionableAssets.length > 0 && actionableAssets.every((asset) => selectedIds.includes(asset.id));

  const toggleAsset = (assetId) => {
    setSelectedIds((current) => (
      current.includes(assetId)
        ? current.filter((id) => id !== assetId)
        : [...current, assetId]
    ));
  };

  const toggleAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedIds((current) => current.filter((id) => !actionableAssets.some((asset) => asset.id === id)));
      return;
    }
    setSelectedIds((current) => [...new Set([...current, ...actionableAssets.map((asset) => asset.id)])]);
  };

  const handleImportAsset = async (assetId) => {
    setActionLoadingId(assetId);
    try {
      const { data } = await api.post(`/clients/${clientId}/network-discovered-assets/${assetId}/import`);
      toast.success(data.action === 'updated' ? 'Documento atualizado.' : 'Ativo importado para a documentação.');
      await loadAssets();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Erro ao importar ativo.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleIgnoreAsset = async (assetId) => {
    if (!window.confirm('Ignorar este ativo descoberto?')) return;
    setActionLoadingId(assetId);
    try {
      await api.post(`/clients/${clientId}/network-discovered-assets/${assetId}/ignore`);
      toast.success('Ativo marcado como ignorado.');
      await loadAssets();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Erro ao ignorar ativo.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleViewInventoryAsset = (equipmentId) => {
    if (!equipmentId) return;
    window.location.href = `/#/editar/${equipmentId}`;
  };

  const handleBulkImport = async () => {
    if (selectedIds.length === 0) {
      toast.error('Selecione ao menos um ativo.');
      return;
    }

    setBulkImporting(true);
    try {
      const { data } = await api.post(`/clients/${clientId}/network-discovered-assets/import-bulk`, {
        asset_ids: selectedIds
      });
      const failures = (data.results || []).filter((item) => item.error).length;
      toast.success(failures ? `Importação concluída com ${failures} falha(s).` : 'Ativos importados para a documentação.');
      await loadAssets();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Erro ao importar ativos selecionados.');
    } finally {
      setBulkImporting(false);
    }
  };

  const getDocumentationStatusStyle = (status) => {
    if (status === 'imported') return { color: 'var(--accent-emerald)', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' };
    if (status === 'updated') return { color: 'var(--accent-blue)', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' };
    if (status === 'ignored') return { color: 'var(--text-light)', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-glass)' };
    return { color: 'var(--primary-gold)', background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.2)' };
  };

  return (
    <div className="content-stack">
      <style>
        {`
          .discovered-assets-card {
            max-width: 100%;
            overflow: hidden;
          }
          .discovered-assets-table-wrap {
            max-width: 100%;
            overflow-x: auto;
            overflow-y: hidden;
            padding-bottom: 4px;
          }
          .discovered-assets-table {
            width: 100%;
            min-width: 1080px;
            table-layout: fixed;
          }
          .discovered-assets-table th,
          .discovered-assets-table td {
            padding-left: 0.55rem;
            padding-right: 0.55rem;
            vertical-align: top;
          }
          .discovered-assets-table th {
            white-space: nowrap;
          }
          .discovered-assets-ports,
          .discovered-assets-method {
            white-space: normal;
            overflow-wrap: anywhere;
            word-break: break-word;
            line-height: 1.45;
          }
          .discovered-assets-actions-cell {
            width: 118px;
            text-align: right;
          }
          .discovered-assets-actions {
            display: flex;
            flex-direction: column;
            align-items: stretch;
            gap: 6px;
            width: 100%;
            max-width: 112px;
            margin-left: auto;
          }
          .discovered-assets-action-button {
            width: 100%;
            max-width: 112px;
            min-width: 0;
            height: 28px !important;
            padding: 0 0.45rem !important;
            font-size: 0.66rem !important;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            justify-content: center;
            gap: 4px;
          }
          .discovered-assets-action-button svg {
            flex: 0 0 auto;
          }
        `}
      </style>
      <div className="glass-panel discovered-assets-card" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ color: 'var(--primary-gold)', background: 'rgba(212,175,55,0.1)', padding: '8px', borderRadius: '10px' }}>
              <Network size={20} />
            </div>
            <div>
              <h2 style={{ color: '#fff', fontSize: '1.2rem', margin: 0 }}>Ativos Descobertos</h2>
              <p style={{ color: 'var(--text-light)', margin: '4px 0 0', fontSize: '0.85rem' }}>
                Ativos identificados pela coleta separada de descoberta de rede.
              </p>
            </div>
          </div>

          <button
            className="btn-outline-premium"
            onClick={loadAssets}
            disabled={loading}
            style={{ height: '40px', padding: '0 1rem' }}
          >
            {loading ? <Loader className="animate-spin" size={16} /> : <RefreshCw size={16} />}
            Atualizar
          </button>
          <button
            className="btn-premium"
            onClick={handleBulkImport}
            disabled={bulkImporting || selectedIds.length === 0}
            style={{ height: '40px', padding: '0 1rem' }}
          >
            {bulkImporting ? <Loader className="animate-spin" size={16} /> : <CheckSquare size={16} />}
            Importar selecionados
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          {FILTERS.map((item) => (
            <button
              key={item.key}
              onClick={() => setFilter(item.key)}
              style={{
                height: '38px',
                padding: '0 0.9rem',
                borderRadius: '12px',
                border: filter === item.key ? '1px solid var(--primary-gold)' : '1px solid var(--border-glass)',
                background: filter === item.key ? 'rgba(212,175,55,0.1)' : 'rgba(255,255,255,0.03)',
                color: filter === item.key ? 'var(--primary-gold)' : 'var(--text-light)',
                cursor: 'pointer',
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {item.label}
              <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>{counters[item.key] || 0}</span>
            </button>
          ))}
        </div>

        <div className="discovered-assets-table-wrap">
        <table className="table-enterprise discovered-assets-table">
          <colgroup>
            <col style={{ width: '38px' }} />
            <col style={{ width: '118px' }} />
            <col style={{ width: '148px' }} />
            <col style={{ width: '145px' }} />
            <col style={{ width: '105px' }} />
            <col style={{ width: '112px' }} />
            <col style={{ width: '86px' }} />
            <col style={{ width: '104px' }} />
            <col style={{ width: '142px' }} />
            <col style={{ width: '120px' }} />
            <col style={{ width: '118px' }} />
          </colgroup>
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleAllVisible}
                  disabled={actionableAssets.length === 0}
                />
              </th>
              <th>IP</th>
              <th>Hostname</th>
              <th>Tipo</th>
              <th>Fabricante</th>
              <th>Modelo</th>
              <th>Portas</th>
              <th>Status</th>
              <th>Método</th>
              <th>Última vez visto</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="11" style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-light)' }}>
                  Carregando ativos descobertos...
                </td>
              </tr>
            ) : filteredAssets.length === 0 ? (
              <tr>
                <td colSpan="11" style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-light)' }}>
                  Nenhum ativo descoberto para este filtro.
                </td>
              </tr>
            ) : (
              filteredAssets.map((asset) => {
                const Icon = TYPE_ICONS[asset.device_type] || HelpCircle;
                const typeStyle = getTypeStyle(asset.device_type);

                return (
                  <tr key={asset.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(asset.id)}
                        onChange={() => toggleAsset(asset.id)}
                        disabled={['imported', 'updated', 'ignored'].includes(asset.documentation_status)}
                      />
                    </td>
                    <td>
                      <div style={{ fontWeight: 800, color: 'var(--accent-blue)' }}>{asset.ip_address || '-'}</div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-light)', overflowWrap: 'anywhere' }}>{asset.mac_address || '-'}</div>
                    </td>
                    <td style={{ color: '#fff', fontWeight: 700, overflowWrap: 'anywhere' }}>
                      <div>{asset.hostname || '-'}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {asset.is_collector ? (
                          <span style={smallBadgeStyle('var(--primary-gold)', 'rgba(212,175,55,0.1)', '1px solid rgba(212,175,55,0.22)')}>
                            Coletor
                          </span>
                        ) : null}
                        {asset.already_in_inventory ? (
                          <span style={smallBadgeStyle('var(--accent-emerald)', 'rgba(16,185,129,0.1)', '1px solid rgba(16,185,129,0.22)')}>
                            Já no inventário
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <span className="status-badge" style={{ ...typeStyle, display: 'inline-flex', alignItems: 'center', gap: '5px', whiteSpace: 'normal', lineHeight: 1.25 }}>
                        <Icon size={13} />
                        {TYPE_LABELS[asset.device_type] || 'Desconhecido'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-light)', fontWeight: 600, overflowWrap: 'anywhere' }}>{asset.vendor || '-'}</td>
                    <td style={{ color: 'var(--text-light)', fontWeight: 600, overflowWrap: 'anywhere' }}>{asset.printer_model || '-'}</td>
                    <td className="discovered-assets-ports" style={{ color: '#fff', fontWeight: 700 }}>{formatPorts(asset.open_ports)}</td>
                    <td>
                      <span className="status-badge" style={{ ...getDocumentationStatusStyle(asset.documentation_status || 'pending'), whiteSpace: 'normal', lineHeight: 1.25 }}>
                        {DOCUMENTATION_STATUS_LABELS[asset.documentation_status || 'pending'] || 'Pendente'}
                      </span>
                    </td>
                    <td className="discovered-assets-method" style={{ color: 'var(--text-light)', fontSize: '0.72rem' }} title={asset.detection_method || '-'}>
                      {asset.detection_method || '-'}
                    </td>
                    <td style={{ color: 'var(--text-light)', fontWeight: 600, fontSize: '0.72rem', lineHeight: 1.35 }}>{formatDate(asset.last_seen)}</td>
                    <td className="discovered-assets-actions-cell">
                      <div className="discovered-assets-actions">
                        <button
                          className="btn-outline-premium discovered-assets-action-button"
                          onClick={() => handleImportAsset(asset.id)}
                          disabled={actionLoadingId === asset.id || asset.documentation_status === 'imported' || asset.documentation_status === 'updated'}
                          title={asset.already_in_inventory ? 'Este ativo ja existe no inventario. A importacao para documentacao sera registrada com essa indicacao.' : 'Importar para documentacao'}
                        >
                          {actionLoadingId === asset.id ? <Loader className="animate-spin" size={13} /> : null}
                          Importar
                        </button>
                        {asset.already_in_inventory && asset.equipment_id ? (
                          <button
                            className="btn-outline-premium discovered-assets-action-button"
                            onClick={() => handleViewInventoryAsset(asset.equipment_id)}
                            style={{ color: 'var(--accent-emerald)' }}
                          >
                            <ExternalLink size={13} />
                            Ver no inventário
                          </button>
                        ) : null}
                        <button
                          className="btn-outline-premium discovered-assets-action-button"
                          onClick={() => handleIgnoreAsset(asset.id)}
                          disabled={actionLoadingId === asset.id || asset.documentation_status === 'ignored'}
                          style={{ color: 'var(--text-light)' }}
                        >
                          Ignorar
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
    </div>
  );
}
