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

$Settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 3) `
    -MultipleInstances IgnoreNew `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable `
    -AllowStartIfOnBatteries:$false `
    -DisallowStartIfOnBatteries

$Principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -Principal $Principal `
    -Description "Goldtech Performance Monitor - coleta leve de CPU, RAM e disco." `
    -Force

Write-Host ""
Write-Host "SUCESSO: Tarefa '$TaskName' criada." -ForegroundColor Green
Write-Host "  Execucao: a cada $IntervalMinutes minuto(s)"
Write-Host "  Script:   $ScriptPath"
Write-Host ""
Write-Host "Para executar agora (teste):"
Write-Host "  Start-ScheduledTask -TaskName $TaskName" -ForegroundColor Yellow
