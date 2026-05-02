import { useEffect, useState } from 'react';
import { 
  Settings as SettingsIcon, Building, Shield, Monitor, 
  Cpu, Globe, Save, Copy, FileCode, Terminal, ChevronDown,
  Download, Users, AlertTriangle
} from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function Settings() {
  const [config, setConfig] = useState({
    companyName: 'Goldtech Soluções em Tecnologia',
    email: 'contato@goldtech.com.br',
    phone: '(11) 98765-4321',
    minRamPC: 8,
    minRamSvr: 16,
    collectionAlertDays: 30,
    watchWin10: true,
    watchServer2016: true
  });

  const [clients, setClients] = useState([]);
  const [scriptClientId, setScriptClientId] = useState('');
  const [scriptToken, setScriptToken] = useState(import.meta.env.VITE_AGENT_TOKEN || 'GOLDTECH_AGENT_2024');
  const [generatedScript, setGeneratedScript] = useState('');

  useEffect(() => {
    const loadClients = async () => {
      try {
        const { data } = await api.get('/clients');
        setClients(data);
      } catch (err) {
        // silencia
      }
    };
    loadClients();
  }, []);

  const handleSave = () => {
    toast.success('Configurações salvas com sucesso');
  };

  const copyEndpoint = () => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';
    navigator.clipboard.writeText(`${API_URL}/api/agent/inventory`);
    toast.success('Endpoint copiado para a área de transferência');
  };

  const generateScript = () => {
    const client = clients.find(c => String(c.id) === String(scriptClientId));
    const clientName = client ? client.name : 'NomeDoCliente';

    if (!scriptClientId) {
      toast.error('Selecione um cliente para gerar o script');
      return;
    }

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';
    const script = `# ==========================================
# Goldtech Inventario - Agente de Coleta v2.0
# Cliente: ${clientName}
# Gerado em: ${new Date().toLocaleString('pt-BR')}
# ==========================================

$ApiUrl = "${API_URL}/api/agent/inventory"
$AgentToken = "${scriptToken}"
$Cliente = "${clientName}"

$Computer = Get-WmiObject Win32_ComputerSystem
$OS = Get-WmiObject Win32_OperatingSystem
$Processor = Get-WmiObject Win32_Processor | Select-Object -First 1
$Disk = Get-WmiObject Win32_LogicalDisk -Filter "DeviceID='C:'"
$NetworkAdapter = Get-WmiObject Win32_NetworkAdapterConfiguration | Where-Object { $_.IPEnabled -eq $True } | Select-Object -First 1
$BIOS = Get-WmiObject Win32_BIOS

$TotalRamGB = [math]::Round($Computer.TotalPhysicalMemory / 1GB, 0)
$DiskTotalGB = [math]::Round($Disk.Size / 1GB, 0)
$DiskFreeGB = [math]::Round($Disk.FreeSpace / 1GB, 1)

$Payload = @{
    cliente             = $Cliente
    hostname            = $env:COMPUTERNAME
    usuario_logado      = $env:USERNAME
    fabricante          = $Computer.Manufacturer
    modelo              = $Computer.Model
    numero_serie        = $BIOS.SerialNumber
    sistema_operacional = $OS.Caption
    processador         = $Processor.Name.Trim()
    memoria_ram_gb      = $TotalRamGB
    disco_total_gb      = $DiskTotalGB
    disco_livre_gb      = $DiskFreeGB
    ip                  = $NetworkAdapter.IPAddress[0]
    mac                 = $NetworkAdapter.MACAddress
    dominio             = $Computer.Domain
    bios_versao         = $BIOS.SMBIOSBIOSVersion
    placa_mae           = (Get-WmiObject Win32_BaseBoard).Product
}

$Headers = @{ "x-agent-token" = $AgentToken; "Content-Type" = "application/json" }
$Body = $Payload | ConvertTo-Json

try {
    $Response = Invoke-RestMethod -Uri $ApiUrl -Method Post -Headers $Headers -Body $Body
    Write-Host "Coleta enviada com sucesso: $($Response.message)" -ForegroundColor Green
} catch {
    Write-Host "Erro ao enviar: $_" -ForegroundColor Red
}`;

    setGeneratedScript(script);
    toast.success(`Script gerado para ${clientName}`);
  };

  const handleDownloadFullAgent = async () => {
    if (!scriptClientId) {
      toast.error('Selecione um cliente para gerar o pacote');
      return;
    }
    const client = clients.find(c => String(c.id) === String(scriptClientId));
    const toastId = toast.loading(`Gerando pacote completo para ${client.name}...`);
    try {
      const response = await api.get(`/clients/${scriptClientId}/agent-package`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const fileName = `Agente_Goldtech_${client.name.replace(/\s+/g, '_')}.zip`;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('Pacote gerado com sucesso!', { id: toastId });
    } catch (err) {
      toast.error('Erro ao gerar pacote', { id: toastId });
    }
  };

  const copyScript = () => {
    if (!generatedScript) return;
    navigator.clipboard.writeText(generatedScript);
    toast.success('Script copiado');
  };

  const downloadScript = () => {
    if (!generatedScript) return;
    const client = clients.find(c => String(c.id) === String(scriptClientId));
    const clientName = (client?.name || 'cliente').replace(/[^a-z0-9]/gi, '_');
    const blob = new Blob([generatedScript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `goldtech-agent-${clientName}.ps1`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Script baixado');
  };

  return (
    <div className="animate-fade content-stack">
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '0.75rem' }}>
          <div style={{ padding: '8px', background: 'rgba(212, 175, 55, 0.1)', borderRadius: '10px', color: 'var(--primary-gold)' }}>
            <SettingsIcon size={24} />
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#fff', margin: 0 }}>Configurações do <span style={{ color: 'var(--primary-gold)' }}>Sistema</span></h1>
        </div>
        <p style={{ color: 'var(--text-light)', fontWeight: 500 }}>Gerencie as diretrizes de obsolescência, parâmetros de coleta e dados institucionais.</p>
      </div>

      <div className="card-grid-2">
        <div className="content-stack">
          {/* Sessão 1: Empresa */}
          <div className="glass-panel" style={{ padding: '2.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2.5rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '1.5rem' }}>
              <Building size={22} color="var(--primary-gold)" />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff' }}>Dados da Empresa</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-light)' }}>Nome da Organização</label>
                <input type="text" className="form-control-premium" value={config.companyName} onChange={e => setConfig({...config, companyName: e.target.value})} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-light)' }}>E-mail Administrativo</label>
                <input type="email" className="form-control-premium" value={config.email} onChange={e => setConfig({...config, email: e.target.value})} />
              </div>
            </div>
          </div>

          {/* Sessão 2: Obsolescência */}
          <div className="glass-panel" style={{ padding: '2.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2.5rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '1.5rem' }}>
              <Cpu size={22} color="var(--accent-red)" />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff' }}>Critérios de Obsolescência</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-light)' }}>RAM Mínima (Desktops/NBs)</label>
                <select className="form-control-premium" value={config.minRamPC} onChange={e => setConfig({...config, minRamPC: e.target.value})}>
                  <option value={4}>4 GB</option>
                  <option value={8}>8 GB</option>
                  <option value={16}>16 GB</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-light)' }}>RAM Mínima (Servidores)</label>
                <select className="form-control-premium" value={config.minRamSvr} onChange={e => setConfig({...config, minRamSvr: e.target.value})}>
                  <option value={8}>8 GB</option>
                  <option value={16}>16 GB</option>
                  <option value={32}>32 GB</option>
                </select>
              </div>
              <div style={{ gridColumn: '1/-1', marginTop: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
                  <input type="checkbox" checked={config.watchWin10} onChange={e => setConfig({...config, watchWin10: e.target.checked})} style={{ width: '20px', height: '20px' }} />
                  <span style={{ color: '#fff', fontWeight: 600 }}>Marcar Windows 10 como "Em Atenção" (Fim de suporte 2025)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input type="checkbox" checked={config.watchServer2016} onChange={e => setConfig({...config, watchServer2016: e.target.checked})} style={{ width: '20px', height: '20px' }} />
                  <span style={{ color: '#fff', fontWeight: 600 }}>Marcar Windows Server 2016 como "Em Atenção"</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="content-stack">
          {/* Sessão 3: Agente de Coleta */}
          <div className="glass-panel" style={{ padding: '2.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2.5rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '1.5rem' }}>
              <Globe size={22} color="var(--accent-blue)" />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff' }}>Endpoint de Coleta</h2>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
              <p style={{ color: 'var(--text-light)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>Endpoint para configuração dos scripts de coleta.</p>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '1.5rem' }}>
                <input 
                  type="text" 
                  readOnly 
                  className="form-control-premium" 
                  value={`${import.meta.env.VITE_API_URL || 'http://localhost:3002'}/api/agent/inventory`} 
                  style={{ fontFamily: 'monospace', fontSize: '0.8rem' }} 
                />
                <button onClick={copyEndpoint} className="btn-outline-premium" style={{ width: '56px', padding: 0 }}><Copy size={18} /></button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-emerald)' }}>
                <Shield size={16} />
                <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>Autenticação: Header x-agent-token</span>
              </div>
              <p style={{ fontSize: '0.65rem', color: 'var(--text-light)', marginTop: '8px' }}>Configure o token no arquivo .env do backend para habilitar o acesso.</p>
            </div>
          </div>

          {/* Sessão 4: Gerar Pacote por Cliente */}
          <div className="glass-panel" style={{ padding: '2.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2.5rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '1.5rem' }}>
              <Terminal size={22} color="var(--primary-gold)" />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff' }}>Gerar Pacote do Agente</h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-light)' }}>Cliente</label>
                <select 
                  className="form-control-premium" 
                  value={scriptClientId} 
                  onChange={e => { setScriptClientId(e.target.value); setGeneratedScript(''); }}
                >
                  <option value="">Selecione um cliente...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={generateScript} className="btn-outline-premium" style={{ flex: 1, height: '48px', fontSize: '0.85rem' }}>
                  <FileCode size={18} /> Visualizar Script
                </button>
                <button onClick={handleDownloadFullAgent} className="btn-premium" style={{ flex: 1, height: '48px', fontSize: '0.85rem' }}>
                  <Download size={18} /> Baixar Pacote Completo (ZIP)
                </button>
              </div>

              {generatedScript && (
                <>
                  <pre style={{ 
                    background: 'rgba(0,0,0,0.4)', 
                    border: '1px solid var(--border-glass)', 
                    borderRadius: '12px', 
                    padding: '1.25rem', 
                    fontSize: '0.7rem', 
                    color: 'var(--accent-emerald)', 
                    overflowX: 'auto',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    fontFamily: 'monospace',
                    lineHeight: 1.6,
                    margin: 0
                  }}>
                    {generatedScript}
                  </pre>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={copyScript} className="btn-outline-premium" style={{ flex: 1, height: '42px' }}>
                      <Copy size={16} /> Copiar
                    </button>
                    <button onClick={downloadScript} className="btn-premium" style={{ flex: 1, height: '42px' }}>
                      <Download size={16} /> Download .ps1
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Salvar */}
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <button onClick={handleSave} className="btn-premium" style={{ width: '100%', height: '56px', fontSize: '1rem' }}>
              <Save size={20} /> Salvar Alterações
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

