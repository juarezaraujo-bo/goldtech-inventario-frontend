# ==============================================================================
# GOLDTECH — Remover Tarefas Agendadas do Agente
# Execute como Administrador
# ==============================================================================

$Tasks = @("GoldtechInventario", "GoldtechPerformance")

foreach ($TaskName in $Tasks) {
    if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        Write-Host "Removida: $TaskName" -ForegroundColor Green
    } else {
        Write-Host "Não encontrada: $TaskName" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Desinstalação concluída." -ForegroundColor Cyan
