# Goldtech Inventory Agent - v2.0

$ApiUrl = "https://goldtech-inventario-api.onrender.com/api/agent/inventory"
$AgentToken = "goldtech_agent_secure_token_2026"
$Cliente = "CLIENTE_TESTE"
$TimeoutSec = 60

try {
    $Hostname = $env:COMPUTERNAME
    $Usuario = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name

    $Bios = Get-CimInstance Win32_Bios
    $System = Get-CimInstance Win32_ComputerSystem
    $Motherboard = Get-CimInstance Win32_BaseBoard
    $OS = Get-CimInstance Win32_OperatingSystem
    $Processor = (Get-CimInstance Win32_Processor | Select-Object -First 1).Name

    $Disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'"
    $DiskTotal = [Math]::Round($Disk.Size / 1GB, 0)
    $DiskFree = [Math]::Round($Disk.FreeSpace / 1GB, 1)

    $NetAdapter = Get-NetAdapter | Where-Object { $_.Status -eq 'Up' } | Select-Object -First 1
    $IP = $null
    $MAC = $null
    if ($NetAdapter) {
        $IPConfig = Get-NetIPConfiguration -InterfaceAlias $NetAdapter.InterfaceAlias
        $IP = $IPConfig.IPv4Address.IPAddress
        $MAC = $NetAdapter.MacAddress
    }

    try {
        $AV = Get-CimInstance -Namespace root/SecurityCenter2 -ClassName AntiVirusProduct
        $AVNames = ($AV.displayName) -join ", "
    } catch {
        $AVNames = "Nao detectado"
    }

    $InventoryData = @{
        cliente = $Cliente
        hostname = $Hostname
        usuario_logado = $Usuario
        fabricante = $System.Manufacturer
        modelo = $System.Model
        numero_serie = $Bios.SerialNumber
        sistema_operacional = $OS.Caption
        versao_windows = "$($OS.Version) (Build $($OS.BuildNumber))"
        arquitetura = $OS.OSArchitecture
        processador = $Processor
        memoria_ram_gb = [Math]::Round($OS.TotalVisibleMemorySize / 1MB, 0)
        disco_total_gb = $DiskTotal
        disco_livre_gb = $DiskFree
        bios_versao = $Bios.SMBIOSBIOSVersion
        bios_data = $Bios.ReleaseDate
        placa_mae = "$($Motherboard.Manufacturer) $($Motherboard.Product)"
        data_instalacao_os = $OS.InstallDate
        ip = $IP
        mac = $MAC
        dominio = $System.Domain
        antivirus = $AVNames
        ultima_inicializacao = $OS.LastBootUpTime
        data_coleta = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
    }

    $Headers = @{
        "x-agent-token" = $AgentToken
        "Content-Type" = "application/json"
    }

    $JsonPayload = $InventoryData | ConvertTo-Json -Compress
    $Response = Invoke-RestMethod -Uri $ApiUrl -Method Post -Body $JsonPayload -Headers $Headers -TimeoutSec $TimeoutSec
    Write-Output "Inventario enviado: $($Response.message)"
    exit 0
} catch {
    Write-Error "Erro ao coletar/enviar inventario: $($_.Exception.Message)"
    exit 1
}
