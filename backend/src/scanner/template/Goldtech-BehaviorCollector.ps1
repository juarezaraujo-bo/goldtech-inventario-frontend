# ============================================================
# Goldtech-BehaviorCollector.ps1
# Coleta dados de comportamento: portas abertas, conexões ativas
# e processos em execução.
# Goldtech Tecnologia - Diagnóstico de Segurança
# ============================================================

param(
    [string]$OutputFile = "resultado-coleta.json"
)

Write-Host "========================================"
Write-Host " Goldtech Network Behavior Collector"
Write-Host "========================================"
Write-Host ""

# Carrega config.json se disponível
$configPath = Join-Path $PSScriptRoot "config.json"
$config = $null
if (Test-Path $configPath) {
    $config = Get-Content $configPath -Raw | ConvertFrom-Json
    Write-Host "[INFO] Configuracao carregada para cliente: $($config.client_name)"
} else {
    Write-Host "[AVISO] config.json nao encontrado. Usando configuracao padrao."
}

# Coleta de conexoes de rede ativas
Write-Host "[1/3] Coletando conexoes de rede..."
$connections = @()
try {
    $netstat = Get-NetTCPConnection -ErrorAction SilentlyContinue | Select-Object LocalAddress, LocalPort, RemoteAddress, RemotePort, State, OwningProcess
    foreach ($conn in $netstat) {
        $processName = ""
        try {
            $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
            $processName = if ($proc) { $proc.ProcessName } else { "N/A" }
        } catch { $processName = "N/A" }
        $connections += [PSCustomObject]@{
            LocalAddress  = $conn.LocalAddress
            LocalPort     = $conn.LocalPort
            RemoteAddress = $conn.RemoteAddress
            RemotePort    = $conn.RemotePort
            State         = $conn.State
            Process       = $processName
            PID           = $conn.OwningProcess
        }
    }
    Write-Host "[OK] $($connections.Count) conexoes coletadas."
} catch {
    Write-Host "[ERRO] Falha ao coletar conexoes: $($_.Exception.Message)"
}

# Coleta de processos em execucao
Write-Host "[2/3] Coletando processos em execucao..."
$processes = @()
try {
    $procs = Get-Process | Select-Object Name, Id, CPU, WorkingSet, Path
    foreach ($p in $procs) {
        $processes += [PSCustomObject]@{
            Name         = $p.Name
            PID          = $p.Id
            CPU          = [math]::Round($p.CPU, 2)
            MemoryMB     = [math]::Round($p.WorkingSet / 1MB, 2)
            Path         = $p.Path
        }
    }
    Write-Host "[OK] $($processes.Count) processos coletados."
} catch {
    Write-Host "[ERRO] Falha ao coletar processos: $($_.Exception.Message)"
}

# Coleta de portas de escuta (listening)
Write-Host "[3/3] Coletando portas em escuta (LISTENING)..."
$listeningPorts = @()
try {
    $listening = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Select-Object LocalAddress, LocalPort, OwningProcess
    foreach ($l in $listening) {
        $processName = ""
        try {
            $proc = Get-Process -Id $l.OwningProcess -ErrorAction SilentlyContinue
            $processName = if ($proc) { $proc.ProcessName } else { "N/A" }
        } catch { $processName = "N/A" }
        $listeningPorts += [PSCustomObject]@{
            LocalAddress = $l.LocalAddress
            Port         = $l.LocalPort
            Process      = $processName
            PID          = $l.OwningProcess
        }
    }
    Write-Host "[OK] $($listeningPorts.Count) portas em escuta coletadas."
} catch {
    Write-Host "[ERRO] Falha ao coletar portas: $($_.Exception.Message)"
}

# Monta resultado
$result = [PSCustomObject]@{
    collection_timestamp = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss")
    client_id            = if ($config) { $config.client_id } else { $null }
    client_name          = if ($config) { $config.client_name } else { "Desconhecido" }
    scanner_version      = if ($config) { $config.scanner_version } else { "0.1" }
    hostname             = $env:COMPUTERNAME
    username             = $env:USERNAME
    connections          = $connections
    processes            = $processes
    listening_ports      = $listeningPorts
}

# Salva resultado
$outputPath = Join-Path $PSScriptRoot $OutputFile
$result | ConvertTo-Json -Depth 10 | Out-File -FilePath $outputPath -Encoding UTF8
Write-Host ""
Write-Host "[CONCLUIDO] Resultado salvo em: $outputPath"
Write-Host ""
