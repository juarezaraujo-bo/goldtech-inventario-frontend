# ==============================================================================
# SCRIPT DE INVENTÁRIO AVANÇADO GOLDTECH v2.0
# ==============================================================================
# Este script coleta informações detalhadas de hardware e envia para o backend.
# Recomenda-se execução como Administrador.

# --- CONFIGURAÇÕES ---
$ApiUrl = "http://localhost:3002/api/agent/inventory"
$AgentToken = "goldtech_agent_secure_token_2026"
$Cliente = "CLIENTE_TESTE" # Altere para o nome do cliente correto

# --- COLETA DE DADOS ---
Write-Host "Coletando informações avançadas do sistema..." -ForegroundColor Cyan

# 1. Hostname e Usuário
$Hostname = $env:COMPUTERNAME
$Usuario = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name

# 2. Fabricante, Modelo e Serial
$Bios = Get-CimInstance Win32_Bios
$System = Get-CimInstance Win32_ComputerSystem
$Motherboard = Get-CimInstance Win32_BaseBoard
$Fabricante = $System.Manufacturer
$Modelo = $System.Model
$SerialNumber = $Bios.SerialNumber

# 3. Sistema Operacional Avançado
$OS = Get-CimInstance Win32_OperatingSystem
$OSName = $OS.Caption
$OSVersion = "$($OS.Version) (Build $($OS.BuildNumber))"
$OSArchitecture = $OS.OSArchitecture
$LastBoot = $OS.LastBootUpTime
$InstallDate = $OS.InstallDate

# 4. Hardware Detalhado (CPU e RAM)
$Processor = (Get-CimInstance Win32_Processor).Name
$TotalRAM = [Math]::Round($OS.TotalVisibleMemorySize / 1024 / 1024, 0) # Em GB

# 5. Disco Detalhado
$Disks = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'"
$DiskTotal = [Math]::Round($Disks.Size / 1024 / 1024 / 1024, 0) # Em GB
$DiskFree = [Math]::Round($Disks.FreeSpace / 1024 / 1024 / 1024, 1) # Em GB

# Detecção avançada de SSD/HDD/NVMe
try {
    $DiskType = (Get-PhysicalDisk | Where-Object { $_.DeviceID -eq 0 }).MediaType
    if ($null -eq $DiskType) { $DiskType = "HDD" }
} catch {
    $DiskType = "N/A"
}

# 6. Rede Completa
$NetAdapter = Get-NetAdapter | Where-Object { $_.Status -eq 'Up' } | Select-Object -First 1
$IPConfig = Get-NetIPConfiguration -InterfaceAlias $NetAdapter.InterfaceAlias
$IP = $IPConfig.IPv4Address.IPAddress
$MAC = $NetAdapter.MacAddress
$Gateway = $IPConfig.IPv4DefaultGateway.NextHop
$DNS = ($IPConfig.DNSServer.ServerAddresses) -join ", "

# 7. Domínio / Grupo de Trabalho
$Domain = $System.Domain
if ($System.PartOfDomain) { $Workgroup = "N/A" } else { $Workgroup = $System.Workgroup; $Domain = "WORKGROUP" }

# 8. Antivírus
try {
    $AV = Get-CimInstance -Namespace root/SecurityCenter2 -ClassName AntiVirusProduct
    $AVNames = ($AV.displayName) -join ", "
} catch {
    $AVNames = "Não detectado"
}

# --- PREPARAÇÃO DO JSON ---
$InventoryData = @{
    cliente = $Cliente
    hostname = $Hostname
    usuario_logado = $Usuario
    fabricante = $Fabricante
    modelo = $Modelo
    numero_serie = $SerialNumber
    sistema_operacional = $OSName
    versao_windows = $OSVersion
    arquitetura = $OSArchitecture
    processador = $Processor
    memoria_ram_gb = $TotalRAM
    disco_total_gb = $DiskTotal
    disco_livre_gb = $DiskFree
    tipo_disco = $DiskType
    bios_versao = $Bios.SMBIOSBIOSVersion
    bios_data = $Bios.ReleaseDate
    placa_mae = "$($Motherboard.Manufacturer) $($Motherboard.Product)"
    data_instalacao_os = $InstallDate
    ip = $IP
    mac = $MAC
    dominio = $Domain
    antivirus = $AVNames
    ultima_inicializacao = $LastBoot
    data_coleta = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
}

$JsonPayload = $InventoryData | ConvertTo-Json

# --- ENVIO PARA A API ---
Write-Host "Enviando inventário avançado para $ApiUrl..." -ForegroundColor Yellow

try {
    $Headers = @{
        "x-agent-token" = $AgentToken
        "Content-Type" = "application/json"
    }

    $Response = Invoke-RestMethod -Uri $ApiUrl -Method Post -Body $JsonPayload -Headers $Headers
    
    Write-Host "`nSUCESSO!" -ForegroundColor Green
    Write-Host "Resposta da API: $($Response.message)"
    Write-Host "ID do Ativo: $($Response.id)"
}
catch {
    Write-Host "`nERRO AO ENVIAR DADOS!" -ForegroundColor Red
    Write-Host "Status Code: $($_.Exception.Response.StatusCode.value__)"
    Write-Host "Mensagem: $($_.Exception.Message)"
}

Write-Host "`nPressione qualquer tecla para sair..."
$null = [Console]::ReadKey()
