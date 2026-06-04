# ============================================================
# Goldtech-AnalyzeBaseline.ps1
# Analisa o arquivo de coleta gerado pelo BehaviorCollector
# com base nas regras de risk-rules.json e no config.json.
# Goldtech Tecnologia - Diagnóstico de Segurança
# ============================================================

param(
    [string]$InputFile  = "resultado-coleta.json",
    [string]$OutputFile = "resultado-diagnostico.json"
)

Write-Host "========================================"
Write-Host " Goldtech Baseline Analyzer"
Write-Host "========================================"
Write-Host ""

# Carrega dados de coleta
$inputPath = Join-Path $PSScriptRoot $InputFile
if (-not (Test-Path $inputPath)) {
    Write-Host "[ERRO] Arquivo de coleta nao encontrado: $inputPath"
    Write-Host "       Execute o BehaviorCollector antes de analisar."
    exit 1
}
$data = Get-Content $inputPath -Raw | ConvertFrom-Json
Write-Host "[INFO] Analisando dados para: $($data.client_name)"

# Carrega config.json
$configPath = Join-Path $PSScriptRoot "config.json"
$config = $null
$allowlist = @()
$sensitiveProcesses = @()
if (Test-Path $configPath) {
    $config = Get-Content $configPath -Raw | ConvertFrom-Json
    $allowlist          = if ($config.allowlist)            { $config.allowlist }            else { @() }
    $sensitiveProcesses = if ($config.sensitive_processes)  { $config.sensitive_processes }  else { @() }
}

# Carrega regras de risco
$rulesPath = Join-Path $PSScriptRoot "risk-rules.json"
$rules = @()
if (Test-Path $rulesPath) {
    $rules = Get-Content $rulesPath -Raw | ConvertFrom-Json
    Write-Host "[INFO] $($rules.Count) regra(s) de risco carregada(s)."
}

$findings = @()

# Regra: Processos sensíveis
Write-Host "[1/3] Verificando processos sensiveis..."
foreach ($proc in $data.processes) {
    if ($sensitiveProcesses -contains $proc.Name) {
        $findings += [PSCustomObject]@{
            rule_id     = "RULE-001"
            severity    = "high"
            description = "Processo sensivel detectado: $($proc.Name) (PID: $($proc.PID))"
            evidence    = $proc
        }
    }
}

# Regra: Portas fora da allowlist
Write-Host "[2/3] Verificando portas fora da allowlist..."
foreach ($port in $data.listening_ports) {
    if ($allowlist.Count -gt 0 -and ($allowlist -notcontains $port.Port)) {
        $findings += [PSCustomObject]@{
            rule_id     = "RULE-002"
            severity    = "medium"
            description = "Porta $($port.Port) em escuta nao esta na allowlist (Processo: $($port.Process))"
            evidence    = $port
        }
    }
}

# Regra: Conexões remotas em portas incomuns
Write-Host "[3/3] Verificando conexoes remotas suspeitas..."
$suspiciousPorts = @(4444, 5555, 6666, 7777, 8080, 9999, 31337)
foreach ($conn in $data.connections) {
    if ($conn.RemoteAddress -ne "0.0.0.0" -and $conn.RemoteAddress -ne "::" -and $suspiciousPorts -contains $conn.RemotePort) {
        $findings += [PSCustomObject]@{
            rule_id     = "RULE-002"
            severity    = "high"
            description = "Conexao remota suspeita na porta $($conn.RemotePort) para $($conn.RemoteAddress)"
            evidence    = $conn
        }
    }
}

Write-Host "[OK] Analise concluida. $($findings.Count) ocorrencia(s) encontrada(s)."

# Monta resultado final
$riskLevel = "low"
if ($findings | Where-Object { $_.severity -eq "high" }) { $riskLevel = "high" }
elseif ($findings | Where-Object { $_.severity -eq "medium" }) { $riskLevel = "medium" }

$result = [PSCustomObject]@{
    analysis_timestamp = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss")
    client_id          = $data.client_id
    client_name        = $data.client_name
    scanner_version    = $data.scanner_version
    hostname           = $data.hostname
    risk_level         = $riskLevel
    total_findings     = $findings.Count
    findings           = $findings
}

# Salva resultado de diagnóstico
$outputPath = Join-Path $PSScriptRoot $OutputFile
$result | ConvertTo-Json -Depth 10 | Out-File -FilePath $outputPath -Encoding UTF8
Write-Host ""
Write-Host "[CONCLUIDO] Diagnostico salvo em: $outputPath"
Write-Host "[RISCO]     Nivel de risco identificado: $($riskLevel.ToUpper())"
Write-Host ""
