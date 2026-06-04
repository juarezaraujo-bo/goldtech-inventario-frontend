# ==============================================================================
# GOLDTECH - Instalar Tarefa Agendada de INVENTARIO
# Execute como Administrador.
# ==============================================================================

param(
    [string]$ScriptPath = "$PSScriptRoot\windows-inventory.ps1",
    [string]$ApiUrl = "https://goldtech-inventario-api.onrender.com/api/agent/inventory",
    [string]$AgentToken = "goldtech_agent_secure_token_2026",
    [string]$Cliente = "NOME_DO_CLIENTE"
)

$TaskName = "GoldtechInventario"

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
$scriptContent = $scriptContent -replace '\$Cliente\s*=\s*"[^"]*"', "`$Cliente = `"$Cliente`""
Set-Content -Path $ScriptPath -Value $scriptContent -Encoding UTF8

$Action = New-ScheduledTaskAction -Execute "PowerShell.exe" `
    -Argument "-NonInteractive -NoProfile -ExecutionPolicy Bypass -File `"$ScriptPath`""

$Trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday -At "10:00AM"

$Settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 30) `
    -MultipleInstances IgnoreNew `
    -RestartCount 2 `
    -RestartInterval (New-TimeSpan -Minutes 5) `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable

$Principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -Principal $Principal `
    -Description "Goldtech Inventario - coleta semanal de hardware." `
    -Force

Write-Host "SUCESSO: Tarefa '$TaskName' criada." -ForegroundColor Green
