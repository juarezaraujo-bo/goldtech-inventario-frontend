# ==============================================================================
# GOLDTECH - Instalar Tarefa Agendada de PERFORMANCE
# Execute como Administrador.
# ==============================================================================

param(
    [string]$ScriptPath = "$PSScriptRoot\windows-performance.ps1",
    [string]$ApiUrl = "https://goldtech-inventario-api.onrender.com/api/agent/performance",
    [string]$AgentToken = "goldtech_agent_secure_token_2026",
    [ValidateSet(15, 30)]
    [int]$IntervalMinutes = 15
)

$TaskName = "GoldtechPerformance"

try {
    $currentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentIdentity)
    $isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
} catch {
    $isAdmin = $false
}

if (-not $isAdmin) {
    Write-Host ""
    Write-Host "ERRO: Este instalador precisa ser executado em um PowerShell como Administrador." -ForegroundColor Red
    Write-Host "Clique com o botao direito no PowerShell e escolha 'Executar como administrador'." -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path $ScriptPath)) {
    throw "Script nao encontrado: $ScriptPath"
}

if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Write-Host "Tarefa '$TaskName' ja existe. Removendo para recriar..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

$scriptContent = Get-Content $ScriptPath -Raw
$scriptContent = $scriptContent -replace '\$ApiUrl\s*=\s*"[^"]*"', "`$ApiUrl = `"$ApiUrl`""
$scriptContent = $scriptContent -replace '\$AgentToken\s*=\s*"[^"]*"', "`$AgentToken = `"$AgentToken`""
Set-Content -Path $ScriptPath -Value $scriptContent -Encoding UTF8

Write-Host "Script configurado com ApiUrl='$ApiUrl'" -ForegroundColor Cyan
Write-Host "Intervalo de coleta: $IntervalMinutes minuto(s)" -ForegroundColor Cyan

$Trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).Date.AddMinutes(5) `
    -RepetitionInterval (New-TimeSpan -Minutes $IntervalMinutes) `
    -RepetitionDuration (New-TimeSpan -Days 3650)

$Action = New-ScheduledTaskAction -Execute "PowerShell.exe" `
    -Argument "-NonInteractive -NoProfile -ExecutionPolicy Bypass -File `"$ScriptPath`""

try {
    $Settings = New-ScheduledTaskSettingsSet `
        -ExecutionTimeLimit (New-TimeSpan -Minutes 3) `
        -MultipleInstances IgnoreNew `
        -StartWhenAvailable `
        -ErrorAction Stop
} catch {
    Write-Host ""
    Write-Host "ERRO: Falha ao criar as configuracoes da tarefa." -ForegroundColor Red
    Write-Host "Detalhe: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

if (-not $Settings) {
    Write-Host ""
    Write-Host "ERRO: As configuracoes da tarefa nao foram criadas." -ForegroundColor Red
    exit 1
}

$Principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

try {
    Register-ScheduledTask `
        -TaskName $TaskName `
        -Action $Action `
        -Trigger $Trigger `
        -Settings $Settings `
        -Principal $Principal `
        -Description "Goldtech Performance Monitor - coleta leve de CPU, RAM e disco." `
        -Force `
        -ErrorAction Stop | Out-Null
} catch {
    Write-Host ""
    Write-Host "ERRO: Falha ao registrar a tarefa '$TaskName'." -ForegroundColor Red
    Write-Host "Detalhe: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

try {
    Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop | Out-Null
} catch {
    Write-Host ""
    Write-Host "ERRO: A tarefa '$TaskName' nao foi encontrada apos a criacao." -ForegroundColor Red
    Write-Host "Detalhe: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "SUCESSO: Tarefa '$TaskName' criada." -ForegroundColor Green
Write-Host "  Execucao: a cada $IntervalMinutes minuto(s)"
Write-Host "  Script:   $ScriptPath"
Write-Host ""
Write-Host "Para executar agora (teste):"
Write-Host "  Start-ScheduledTask -TaskName $TaskName" -ForegroundColor Yellow
