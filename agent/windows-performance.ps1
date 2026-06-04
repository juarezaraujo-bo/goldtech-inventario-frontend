# Goldtech Performance Agent - v2.0
# Coleta leve de CPU, RAM e disco para monitoramento.

$ApiUrl = "https://goldtech-inventario-api.onrender.com/api/agent/performance"
$AgentToken = "goldtech_agent_secure_token_2026"
$Hostname = $env:COMPUTERNAME
$TimeoutSec = 20
$LockFile = Join-Path $env:TEMP "goldtech-performance.lock"

function Get-PerformanceData {
    try {
        $cpu = $null
        try {
            $cpu = (Get-Counter '\Processor(_Total)\% Processor Time' -SampleInterval 1 -MaxSamples 1 -ErrorAction Stop).CounterSamples.CookedValue
        } catch {
            $cpu = (Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average
        }

        $os = Get-CimInstance Win32_OperatingSystem
        $totalRam = $os.TotalVisibleMemorySize
        $freeRam = $os.FreePhysicalMemory
        $memUsage = [Math]::Round(((($totalRam - $freeRam) / $totalRam) * 100), 2)

        $diskC = Get-PSDrive C
        $diskTotal = $diskC.Used + $diskC.Free
        $diskFreePercent = [Math]::Round(($diskC.Free / $diskTotal * 100), 2)
        $diskFreeGb = [Math]::Round(($diskC.Free / 1GB), 2)

        $netTotal = 0
        try {
            $net = (Get-Counter '\Network Interface(*)\Bytes Total/sec' -SampleInterval 1 -MaxSamples 1 -ErrorAction Stop).CounterSamples | Measure-Object -Property CookedValue -Sum
            $netTotal = [Math]::Round(($net.Sum / 1KB), 2)
        } catch {
            $netTotal = 0
        }

        return @{
            hostname = $Hostname
            cpu_usage_percent = [Math]::Round($cpu, 2)
            memory_usage_percent = $memUsage
            disk_free_percent = $diskFreePercent
            disk_free_gb = $diskFreeGb
            network_usage = "$($netTotal) KB/s"
        }
    } catch {
        Write-Error "Falha ao coletar dados: $($_.Exception.Message)"
        return $null
    }
}

if (Test-Path $LockFile) {
    $lockAge = (Get-Date) - (Get-Item $LockFile).LastWriteTime
    if ($lockAge.TotalMinutes -lt 10) {
        Write-Output "Coleta anterior ainda em execucao. Encerrando para evitar sobreposicao."
        exit 0
    }
    Remove-Item $LockFile -Force -ErrorAction SilentlyContinue
}

try {
    New-Item -Path $LockFile -ItemType File -Force | Out-Null

    $data = Get-PerformanceData

    if ($data) {
        $json = $data | ConvertTo-Json -Compress
        Write-Output "Enviando dados de performance para $ApiUrl..."

        try {
            $response = Invoke-RestMethod -Uri $ApiUrl -Method Post -Body $json -ContentType "application/json" -Headers @{"x-agent-token" = $AgentToken} -TimeoutSec $TimeoutSec
            Write-Output "Sucesso: $($response.message)"
        } catch {
            Write-Error "Erro ao enviar dados: $($_.Exception.Message)"
        }
    }
} finally {
    Remove-Item $LockFile -Force -ErrorAction SilentlyContinue
}




