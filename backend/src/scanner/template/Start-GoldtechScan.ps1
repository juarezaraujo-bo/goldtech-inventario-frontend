# ============================================================
# Start-GoldtechScan.ps1
# Orquestrador do diagnóstico de segurança.
# Executa o BehaviorCollector e depois o AnalyzeBaseline.
# Goldtech Tecnologia - Diagnóstico de Segurança
# ============================================================

Write-Host "========================================"
Write-Host " Goldtech Network Behavior Scanner"
Write-Host " Iniciando diagnostico completo..."
Write-Host "========================================"
Write-Host ""

$ScriptDir = $PSScriptRoot

# Etapa 1: Coleta
Write-Host ">>> ETAPA 1: Coleta de Comportamento"
Write-Host "------------------------------------"
& "$ScriptDir\Goldtech-BehaviorCollector.ps1"
if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne $null) {
    Write-Host "[ERRO] BehaviorCollector falhou. Encerrando."
    exit 1
}

Write-Host ""

# Etapa 2: Análise
Write-Host ">>> ETAPA 2: Analise de Baseline e Risco"
Write-Host "-----------------------------------------"
& "$ScriptDir\Goldtech-AnalyzeBaseline.ps1"
if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne $null) {
    Write-Host "[ERRO] AnalyzeBaseline falhou."
    exit 1
}

Write-Host ""
Write-Host "========================================"
Write-Host " Diagnostico concluido com sucesso!"
Write-Host " Arquivos de resultado gerados em:"
Write-Host "   $ScriptDir\resultado-coleta.json"
Write-Host "   $ScriptDir\resultado-diagnostico.json"
Write-Host ""
Write-Host " Encaminhe os arquivos de resultado"
Write-Host " ao analista Goldtech para revisao."
Write-Host "========================================"
Write-Host ""
