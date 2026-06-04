# ==============================================================================
# GOLDTECH — Instalar Tarefa Agendada de INVENTÁRIO
# Executa windows-inventory.ps1 toda semana (Domingo às 02:00)
# Execute como Administrador
# ==============================================================================

param(
    [string]$ScriptPath = "$PSScriptRoot\windows-inventory.ps1",
    [string]$ApiUrl     = "http://SEU-SERVIDOR:3002/api/agent/inventory",
    [string]$AgentToken = "goldtech_agent_secure_token_2026",
    [string]$Cliente    = "NOME_DO_CLIENTE"
)

$TaskName = "GoldtechInventario"

# Verificar se já existe
if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Write-Host "Tarefa '$TaskName' já existe. Removendo para recriar..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

# Atualizar as variáveis no script antes de agendar
$scriptContent = Get-Content $ScriptPath -Raw
$scriptContent = $scriptContent -replace '\$ApiUrl\s*=\s*"[^"]*"',  "`$ApiUrl     = `"$ApiUrl`""
$scriptContent = $scriptContent -replace '\$AgentToken\s*=\s*"[^"]*"', "`$AgentToken = `"$AgentToken`""
$scriptContent = $scriptContent -replace '\$Cliente\s*=\s*"[^"]*"',  "`$Cliente    = `"$Cliente`""
Set-Content -Path $ScriptPath -Value $scriptContent -Encoding UTF8

Write-Host "Script configurado com ApiUrl='$ApiUrl' e Cliente='$Cliente'" -ForegroundColor Cyan

# Criar a tarefa
$Action  = New-ScheduledTaskAction -Execute "PowerShell.exe" `
    -Argument "-NonInteractive -NoProfile -ExecutionPolicy Bypass -File `"$ScriptPath`""

$Trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday -At "10:00AM"

$Settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Hours 1) `
    -RestartCount 2 `
    -RestartInterval (New-TimeSpan -Minutes 5) `
    -StartWhenAvailable

$Principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -Principal $Principal `
    -Description "Goldtech Inventário — coleta semanal de hardware e envia para o backend." `
    -Force

Write-Host ""
Write-Host "SUCESSO: Tarefa '$TaskName' criada." -ForegroundColor Green
Write-Host "  Execução: Segundas às 10:00"
Write-Host "  Script:   $ScriptPath"
Write-Host ""
Write-Host "Para executar agora (teste):"
Write-Host "  Start-ScheduledTask -TaskName $TaskName" -ForegroundColor Yellow
