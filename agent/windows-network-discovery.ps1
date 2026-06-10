# Goldtech Network Discovery Agent - v1.0
# Coleta leve de ativos na rede local. Nao substitui inventario nem performance.

param(
    [string]$ApiUrl = "https://goldtech-inventario-api.onrender.com/api/agent/network-discovery",
    [string]$AgentToken = "goldtech_agent_secure_token_2026",
    [string]$ClientId = "",
    [string]$Cliente = "CLIENTE_TESTE",
    [string]$InterfaceAlias = "",
    [string]$TargetSubnet = "",
    [int]$TimeoutMs = 450,
    [int]$ScanLimit = 254,
    [switch]$DryRun
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$PrinterPorts = @(9100, 515, 631, 80, 443, 161, 5357)
$ScanPorts = @(9100, 515, 631, 80, 443, 161, 5357, 22, 135, 139, 445, 3389, 5985, 5986)
$IgnoredInterfacePatterns = @(
    'vEthernet', 'Hyper-V', 'WSL', 'Docker', 'VirtualBox', 'VMware',
    'OpenVPN', 'WireGuard', 'Tailscale', 'ZeroTier', 'Loopback',
    'Bluetooth', 'Npcap', 'TAP', 'WAN Miniport'
)

$VendorOuis = @{
    "001A4B" = "HP"; "3CD92B" = "HP"; "D48564" = "HP"; "B05ADA" = "HP"; "F0921C" = "HP"
    "008077" = "Brother"; "001BA9" = "Brother"; "30055C" = "Brother"; "B42200" = "Brother"
    "000085" = "Canon"; "F48139" = "Canon"; "001E8F" = "Canon"
    "000048" = "Epson"; "0026AB" = "Epson"; "389D92" = "Epson"
    "000074" = "Ricoh"; "002673" = "Ricoh"; "00C0EE" = "Kyocera"
    "0000AA" = "Xerox"; "9C934E" = "Xerox"; "00074D" = "Zebra"
    "001B54" = "Cisco"; "F4F5D8" = "Cisco"; "D8B190" = "Cisco"
    "DC2C6E" = "MikroTik"; "48A98A" = "MikroTik"
    "B4FBE4" = "Ubiquiti"; "FCECDA" = "Ubiquiti"; "24A43C" = "Ubiquiti"
    "00155D" = "Microsoft"; "000D3A" = "Microsoft"
    "3C2C30" = "Dell"; "F8B156" = "Dell"; "B083FE" = "Dell"
    "A4BB6D" = "Lenovo"; "6C4B90" = "Lenovo"; "D8CB8A" = "Lenovo"
    "F0D5BF" = "Intel"; "A0369F" = "Intel"; "001B21" = "Intel"
    "F01898" = "Apple"; "A4C361" = "Apple"; "3C15C2" = "Apple"
    "E4F4C6" = "TP-Link"; "D8B04C" = "TP-Link"; "C46E1F" = "TP-Link"
    "70A741" = "ARRIS"; "001DD5" = "ARRIS"
    "001E10" = "Huawei"; "F8E811" = "Huawei"
    "002454" = "Samsung"; "5CF6DC" = "Samsung"; "78D6F0" = "Samsung"; "B8BC1B" = "Samsung"
    "001E75" = "LG"; "001C62" = "LG"; "7C1C4E" = "LG"; "B4E62D" = "LG"
    "0013A9" = "Sony"; "001A80" = "Sony"; "F0BF97" = "Sony"; "E063E5" = "Sony"
    "002709" = "Nintendo"; "7CBB8A" = "Nintendo"; "CC9E00" = "Nintendo"
    "B8A175" = "Roku"; "D8D6F3" = "Roku"; "DC3A5E" = "Roku"
    "F0272D" = "Amazon"; "44D9E7" = "Amazon"; "68DBCA" = "Amazon"
    "6CF373" = "Google"; "A4D1D2" = "Google"; "54AF97" = "Google"; "F4F5E8" = "Google"
    "64B473" = "Xiaomi"; "F0B429" = "Xiaomi"; "28E31F" = "Xiaomi"
    "001A3F" = "Intelbras"; "B4A5EF" = "Intelbras"
    "C056E3" = "Hikvision"; "44A6E5" = "Hikvision"; "BCAD28" = "Hikvision"
    "3C1B0D" = "Dahua"; "90D7EB" = "Dahua"; "D848EE" = "Dahua"
}

function Normalize-Mac {
    param([string]$Mac)
    if ([string]::IsNullOrWhiteSpace($Mac)) { return $null }
    $clean = ($Mac -replace '[^0-9A-Fa-f]', '').ToUpperInvariant()
    if ($clean.Length -lt 12) { return $null }
    return (($clean.Substring(0, 12) -split '(.{2})' | Where-Object { $_ }) -join ':')
}

function Get-MacVendor {
    param([string]$Mac)
    $normalized = Normalize-Mac $Mac
    if (-not $normalized) { return $null }
    $oui = ($normalized -replace ':', '').Substring(0, 6)
    if ($VendorOuis.ContainsKey($oui)) { return $VendorOuis[$oui] }
    return $null
}

function ConvertTo-IPv4Int {
    param([string]$Address)
    $bytes = [System.Net.IPAddress]::Parse($Address).GetAddressBytes()
    [Array]::Reverse($bytes)
    return [BitConverter]::ToUInt32($bytes, 0)
}

function ConvertFrom-IPv4Int {
    param([uint32]$Value)
    $bytes = [BitConverter]::GetBytes($Value)
    [Array]::Reverse($bytes)
    return ([System.Net.IPAddress]::new($bytes)).ToString()
}

function Convert-SubnetMaskToPrefixLength {
    param([string]$Mask)
    try {
        $maskInt = ConvertTo-IPv4Int $Mask
        $bits = [Convert]::ToString($maskInt, 2).PadLeft(32, '0')
        return ($bits.ToCharArray() | Where-Object { $_ -eq '1' }).Count
    } catch {
        return 24
    }
}

function Test-ValidIPv4 {
    param([string]$Ip)
    return $Ip -match '^\d{1,3}(\.\d{1,3}){3}$' -and $Ip -ne '127.0.0.1' -and $Ip -notlike '169.254*'
}

function Get-InterfaceIgnoreReason {
    param([string]$Alias, [string]$Description)
    $text = "$Alias $Description"
    foreach ($pattern in $IgnoredInterfacePatterns) {
        if ($text -match [regex]::Escape($pattern)) {
            return "nome/descricao contem '$pattern'"
        }
    }
    return $null
}

function New-InterfaceCandidate {
    param(
        [string]$Alias,
        [string]$Description,
        [string]$Ip,
        [int]$PrefixLength,
        [string]$Gateway,
        [string]$Source
    )

    return [pscustomobject]@{
        Alias = $Alias
        Description = $Description
        IP = $Ip
        PrefixLength = $PrefixLength
        Gateway = $Gateway
        Source = $Source
    }
}

function Get-NetworkInterfaces {
    $candidates = New-Object System.Collections.Generic.List[object]
    $ignored = New-Object System.Collections.Generic.List[object]
    $usedNetConfig = $false

    try {
        $configs = Get-NetIPConfiguration -ErrorAction Stop | Where-Object { $_.IPv4Address }
        $usedNetConfig = $true
        foreach ($config in $configs) {
            $alias = $config.InterfaceAlias
            $description = if ($config.NetAdapter) { $config.NetAdapter.InterfaceDescription } else { $alias }
            $status = if ($config.NetAdapter) { $config.NetAdapter.Status } else { 'Unknown' }
            $gateway = if ($config.IPv4DefaultGateway) { $config.IPv4DefaultGateway.NextHop } else { $null }
            $addr = $config.IPv4Address | Where-Object { Test-ValidIPv4 $_.IPAddress } | Select-Object -First 1

            if ($InterfaceAlias -and $alias -ne $InterfaceAlias) {
                $ignored.Add([pscustomobject]@{ Alias = $alias; IP = if ($addr) { $addr.IPAddress } else { '-' }; Reason = 'alias diferente do solicitado' })
                continue
            }
            if ($status -ne 'Up') {
                $ignored.Add([pscustomobject]@{ Alias = $alias; IP = if ($addr) { $addr.IPAddress } else { '-' }; Reason = "status $status" })
                continue
            }
            if (-not $addr) {
                $ignored.Add([pscustomobject]@{ Alias = $alias; IP = '-'; Reason = 'sem IPv4 valido' })
                continue
            }
            if (-not (Test-ValidIPv4 $gateway)) {
                $ignored.Add([pscustomobject]@{ Alias = $alias; IP = $addr.IPAddress; Reason = 'sem gateway IPv4 valido' })
                continue
            }
            $virtualReason = Get-InterfaceIgnoreReason -Alias $alias -Description $description
            if (-not $InterfaceAlias -and $virtualReason) {
                $ignored.Add([pscustomobject]@{ Alias = $alias; IP = $addr.IPAddress; Reason = $virtualReason })
                continue
            }

            $candidates.Add((New-InterfaceCandidate -Alias $alias -Description $description -Ip $addr.IPAddress -PrefixLength ([int]$addr.PrefixLength) -Gateway $gateway -Source 'Get-NetIPConfiguration'))
        }
    } catch {}

    if (-not $usedNetConfig -or $candidates.Count -eq 0) {
        $wmiConfigs = Get-CimInstance Win32_NetworkAdapterConfiguration -Filter "IPEnabled = True" -ErrorAction SilentlyContinue |
            Where-Object { $_.IPAddress }

        foreach ($config in $wmiConfigs) {
            $alias = $config.Description
            $description = $config.Description
            $ip = $config.IPAddress | Where-Object { Test-ValidIPv4 $_ } | Select-Object -First 1
            $gateway = $config.DefaultIPGateway | Where-Object { Test-ValidIPv4 $_ } | Select-Object -First 1
            $mask = $config.IPSubnet | Where-Object { Test-ValidIPv4 $_ } | Select-Object -First 1

            if ($InterfaceAlias -and $alias -ne $InterfaceAlias) {
                $ignored.Add([pscustomobject]@{ Alias = $alias; IP = if ($ip) { $ip } else { '-' }; Reason = 'alias diferente do solicitado' })
                continue
            }
            if (-not $ip) {
                $ignored.Add([pscustomobject]@{ Alias = $alias; IP = '-'; Reason = 'sem IPv4 valido' })
                continue
            }
            if (-not $gateway) {
                $ignored.Add([pscustomobject]@{ Alias = $alias; IP = $ip; Reason = 'sem gateway IPv4 valido' })
                continue
            }
            $virtualReason = Get-InterfaceIgnoreReason -Alias $alias -Description $description
            if (-not $InterfaceAlias -and $virtualReason) {
                $ignored.Add([pscustomobject]@{ Alias = $alias; IP = $ip; Reason = $virtualReason })
                continue
            }

            $candidates.Add((New-InterfaceCandidate -Alias $alias -Description $description -Ip $ip -PrefixLength (Convert-SubnetMaskToPrefixLength $mask) -Gateway $gateway -Source 'Win32_NetworkAdapterConfiguration'))
        }
    }

    return @{
        Selected = $candidates
        Ignored = $ignored
    }
}

function Get-ScanTargets {
    param([string]$LocalIp, [int]$PrefixLength, [int]$Limit, [string]$Subnet = "")

    if (-not [string]::IsNullOrWhiteSpace($Subnet)) {
        $subnetMatch = [regex]::Match($Subnet, '^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$')
        if (-not $subnetMatch.Success) {
            throw "TargetSubnet invalida. Use o formato 192.168.0.0/24."
        }
        $LocalIp = $subnetMatch.Groups[1].Value
        $PrefixLength = [int]$subnetMatch.Groups[2].Value
    }

    $ipInt = ConvertTo-IPv4Int $LocalIp
    $effectivePrefix = if ([string]::IsNullOrWhiteSpace($Subnet) -and $PrefixLength -lt 24) { 24 } else { $PrefixLength }
    $mask = [uint32]([uint32]::MaxValue -shl (32 - $effectivePrefix))
    $network = $ipInt -band $mask
    $broadcast = $network -bor (-bnot $mask)

    $targets = New-Object System.Collections.Generic.List[string]
    for ($current = $network + 1; $current -lt $broadcast; $current++) {
        if ($targets.Count -ge $Limit) { break }
        $target = ConvertFrom-IPv4Int ([uint32]$current)
        if ([string]::IsNullOrWhiteSpace($Subnet) -and $target -eq $LocalIp) { continue }
        $targets.Add($target)
    }

    return @{
        Targets = $targets
        Subnet = "$(ConvertFrom-IPv4Int $network)/$effectivePrefix"
    }
}

function Test-HostAlive {
    param([string]$Ip, [int]$Timeout)
    try {
        $ping = [System.Net.NetworkInformation.Ping]::new()
        $reply = $ping.Send($Ip, $Timeout)
        return $reply.Status -eq [System.Net.NetworkInformation.IPStatus]::Success
    } catch {
        return $false
    }
}

function Get-ArpTable {
    $items = @{}
    try {
        $lines = arp -a
        foreach ($line in $lines) {
            if ($line -match '^\s*(\d{1,3}(?:\.\d{1,3}){3})\s+([0-9a-fA-F:-]{11,17})\s+') {
                $items[$matches[1]] = Normalize-Mac $matches[2]
            }
        }
    } catch {}
    return $items
}

function Test-TcpPort {
    param([string]$Ip, [int]$Port, [int]$Timeout)
    $client = $null
    try {
        $client = [System.Net.Sockets.TcpClient]::new()
        $async = $client.BeginConnect($Ip, $Port, $null, $null)
        if (-not $async.AsyncWaitHandle.WaitOne($Timeout, $false)) { return $false }
        $client.EndConnect($async)
        return $true
    } catch {
        return $false
    } finally {
        if ($client) { $client.Close() }
    }
}

function Resolve-Hostname {
    param([string]$Ip)
    $names = @()
    try {
        $names += ([System.Net.Dns]::GetHostEntry($Ip)).HostName
    } catch {}
    try {
        $resolver = Get-Command Resolve-DnsName -ErrorAction SilentlyContinue
        if ($resolver) {
            $dns = Resolve-DnsName -Name $Ip -ErrorAction SilentlyContinue | Where-Object { $_.NameHost } | Select-Object -First 1
            if ($dns) { $names += $dns.NameHost }
        }
    } catch {}
    try {
        $nbt = nbtstat -A $Ip 2>$null
        foreach ($line in $nbt) {
            if ($line -match '^\s*([A-Za-z0-9_-]{2,15})\s+<00>\s+UNIQUE') {
                $names += $matches[1]
                break
            }
        }
    } catch {}

    $name = $names | Where-Object { -not [string]::IsNullOrWhiteSpace($_) -and $_ -ne $Ip } | Select-Object -First 1
    if ($name) { return $name }
    return $null
}

function Get-LocalMacAddress {
    param([string]$InterfaceAlias, [string]$LocalIp)
    try {
        $adapter = Get-NetAdapter -InterfaceAlias $InterfaceAlias -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($adapter -and $adapter.MacAddress) { return (Normalize-Mac $adapter.MacAddress) }
    } catch {}
    try {
        $configs = Get-CimInstance Win32_NetworkAdapterConfiguration -Filter "IPEnabled = True" -ErrorAction SilentlyContinue
        foreach ($config in $configs) {
            if ($config.IPAddress -contains $LocalIp -and $config.MACAddress) {
                return (Normalize-Mac $config.MACAddress)
            }
        }
    } catch {}
    return $null
}

function Get-SnmpModel {
    param([string]$Ip)
    $snmpget = Get-Command snmpget -ErrorAction SilentlyContinue
    if (-not $snmpget) { return $null }

    try {
        $output = & $snmpget.Path -v 1 -c public -t 1 -r 0 $Ip "1.3.6.1.2.1.1.1.0" 2>$null
        if ($LASTEXITCODE -eq 0 -and $output) {
            return (($output -join ' ') -replace '^.*STRING:\s*"?', '' -replace '"$', '').Trim()
        }
    } catch {}
    return $null
}

function Test-PrinterVendor {
    param([string]$Text)
    if ([string]::IsNullOrWhiteSpace($Text)) { return $false }
    return $Text -match '(?i)\b(HP|Hewlett[- ]Packard|Brother|Canon|Epson|Ricoh|Kyocera|Xerox|Zebra|Lexmark|Samsung Printing)\b'
}

function Test-PrinterText {
    param([string]$Text)
    if ([string]::IsNullOrWhiteSpace($Text)) { return $false }
    return (Test-PrinterVendor $Text) -or ($Text -match '(?i)\b(printer|print server|jetdirect|laserjet|officejet|deskjet|pagewide|imageclass|pixma|workforce|ecotank|stylus|bizhub|docucentre|phaser)\b')
}

function Test-MediaOrIotVendor {
    param([string]$Text)
    if ([string]::IsNullOrWhiteSpace($Text)) { return $false }
    return $Text -match '(?i)\b(Samsung|LG|Sony|Microsoft|Nintendo|Apple|Roku|Amazon|Google|Xiaomi|Intelbras|TP-Link|Hikvision|Dahua)\b'
}

function ConvertFrom-HtmlText {
    param([string]$Text)
    if ([string]::IsNullOrWhiteSpace($Text)) { return $null }
    try {
        $decoded = [System.Net.WebUtility]::HtmlDecode($Text)
    } catch {
        $decoded = $Text
    }
    $decoded = ($decoded -replace '<[^>]+>', ' ' -replace '\s+', ' ').Trim()
    if ([string]::IsNullOrWhiteSpace($decoded)) { return $null }
    if ($decoded -match '&#\d+;|&[a-zA-Z]+;') { return $null }
    if ($decoded -notmatch '[A-Za-z]{2,}') { return $null }
    if ($decoded.Length -gt 120) { $decoded = $decoded.Substring(0, 120).Trim() }
    return $decoded
}

function Get-HttpModel {
    param([string]$Ip, [int[]]$OpenPorts)
    $schemes = @()
    if ($OpenPorts -contains 80) { $schemes += "http" }
    if ($OpenPorts -contains 443) { $schemes += "https" }

    foreach ($scheme in $schemes) {
        try {
            $response = Invoke-WebRequest -Uri "${scheme}://$Ip/" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
            $title = $null
            if ($response.Content -match '<title[^>]*>(.*?)</title>') {
                $title = ConvertFrom-HtmlText $matches[1]
            }
            $content = ConvertFrom-HtmlText (($title, $response.Content) -join ' ')
            if ($content -and $content -match '(?i)(HP|Hewlett[- ]Packard|Brother|Canon|Epson|Ricoh|Kyocera|Xerox|Zebra|Lexmark|Samsung Printing)[^<\r\n]{0,80}') {
                return (ConvertFrom-HtmlText $matches[0])
            }
            if ($content -and $content -match '(?i)(Samsung|LG|Sony|Microsoft|Nintendo|Apple|Roku|Amazon|Google|Xiaomi|Intelbras|TP-Link|Hikvision|Dahua)[^<\r\n]{0,80}') {
                return (ConvertFrom-HtmlText $matches[0])
            }
            if ($title -and (Test-PrinterText $title)) { return $title }
            if ($title -and (Test-MediaOrIotVendor $title)) { return $title }
        } catch {}
    }
    return $null
}

function Get-DeviceType {
    param([int[]]$OpenPorts, [string]$Vendor, [string]$Hostname, [string]$PrinterModel, [string]$ModelSource)

    $vendorText = if ($Vendor) { $Vendor.ToLowerInvariant() } else { '' }
    $hostText = if ($Hostname) { $Hostname.ToLowerInvariant() } else { '' }
    $networkVendor = @('cisco', 'mikrotik', 'ubiquiti')
    $hasPrinterPort = [bool]($OpenPorts | Where-Object { @(9100, 515, 631) -contains $_ })
    $hasWindowsPort = [bool]($OpenPorts | Where-Object { @(135, 139, 445, 3389, 5985, 5986) -contains $_ })
    $looksServer = $hostText -match 'srv|server|dc-|sql|fileserver'
    $looksMediaOrIot = Test-MediaOrIotVendor $Vendor

    if ($hasPrinterPort) { return 'printer' }
    if ($ModelSource -eq 'snmp' -and (Test-PrinterText $PrinterModel)) { return 'printer' }
    if ((Test-PrinterVendor $Vendor) -and $hasPrinterPort) { return 'printer' }
    if ($looksServer -and (($OpenPorts -contains 22) -or $hasWindowsPort)) { return 'server' }
    if ($hasWindowsPort) { return 'workstation' }
    if ($looksMediaOrIot) { return 'media_device' }
    if ($networkVendor | Where-Object { $vendorText -like "*$_*" }) { return 'network_device' }
    if ($OpenPorts | Where-Object { @(22, 80, 443, 161, 5357) -contains $_ }) { return 'network_device' }
    return 'unknown'
}

try {
    $scanPlans = New-Object System.Collections.Generic.List[object]
    $ignoredInterfaces = New-Object System.Collections.Generic.List[object]
    $selectedInterfaces = New-Object System.Collections.Generic.List[object]
    $seenSubnets = @{}

    if (-not [string]::IsNullOrWhiteSpace($TargetSubnet)) {
        $interfaceResult = Get-NetworkInterfaces
        $ignoredInterfaces = $interfaceResult.Ignored
        foreach ($iface in $interfaceResult.Selected) {
            $selectedInterfaces.Add($iface)
        }

        $scan = Get-ScanTargets -LocalIp "0.0.0.0" -PrefixLength 24 -Limit $ScanLimit -Subnet $TargetSubnet
        $scanPlans.Add([pscustomobject]@{
            Alias = 'TargetSubnet'
            IP = '-'
            Subnet = $scan.Subnet
            Targets = $scan.Targets
        })
    } else {
        $interfaceResult = Get-NetworkInterfaces
        $ignoredInterfaces = $interfaceResult.Ignored

        foreach ($iface in $interfaceResult.Selected) {
            $scan = Get-ScanTargets -LocalIp $iface.IP -PrefixLength $iface.PrefixLength -Limit $ScanLimit
            if ($seenSubnets.ContainsKey($scan.Subnet)) {
                $ignoredInterfaces.Add([pscustomobject]@{ Alias = $iface.Alias; IP = $iface.IP; Reason = "subnet duplicada $($scan.Subnet)" })
                continue
            }

            $seenSubnets[$scan.Subnet] = $true
            $selectedInterfaces.Add($iface)
            $scanPlans.Add([pscustomobject]@{
                Alias = $iface.Alias
                IP = $iface.IP
                Subnet = $scan.Subnet
                Targets = $scan.Targets
            })
        }
    }

    if ($scanPlans.Count -eq 0) {
        Write-Output "Interfaces selecionadas para varredura: nenhuma"
        if ($ignoredInterfaces.Count -gt 0) {
            Write-Output "Interfaces ignoradas:"
            foreach ($ignored in $ignoredInterfaces) {
                Write-Output " - Interface: $($ignored.Alias) | IP: $($ignored.IP) | Motivo: $($ignored.Reason)"
            }
        } else {
            Write-Output "Interfaces ignoradas: nenhuma"
        }
        throw "Nenhuma interface fisica valida encontrada para descoberta de rede."
    }

    Write-Output "Interfaces selecionadas para varredura:"
    foreach ($plan in $scanPlans) {
        Write-Output " - Interface: $($plan.Alias) | IP local: $($plan.IP) | Subnet: $($plan.Subnet)"
    }

    if ($ignoredInterfaces.Count -gt 0) {
        Write-Output "Interfaces ignoradas:"
        foreach ($ignored in $ignoredInterfaces) {
            Write-Output " - Interface: $($ignored.Alias) | IP: $($ignored.IP) | Motivo: $($ignored.Reason)"
        }
    } else {
        Write-Output "Interfaces ignoradas: nenhuma"
    }

    $activeIps = New-Object System.Collections.Generic.HashSet[string]
    foreach ($plan in $scanPlans) {
        Write-Output "Iniciando varredura leve em $($plan.Targets.Count) IP(s) na subnet $($plan.Subnet)..."
        foreach ($target in $plan.Targets) {
            if (Test-HostAlive -Ip $target -Timeout $TimeoutMs) {
                [void]$activeIps.Add($target)
            }
        }

        $arpForPlan = Get-ArpTable
        foreach ($ip in $arpForPlan.Keys) {
            if ($plan.Targets -contains $ip) { [void]$activeIps.Add($ip) }
        }
    }

    $arp = Get-ArpTable
    $assets = @()
    foreach ($iface in $selectedInterfaces) {
        $localMac = Get-LocalMacAddress -InterfaceAlias $iface.Alias -LocalIp $iface.IP
        $localVendor = Get-MacVendor $localMac
        $assets += [ordered]@{
            ip_address = $iface.IP
            mac_address = $localMac
            hostname = $env:COMPUTERNAME
            vendor = $localVendor
            device_type = 'workstation'
            printer_model = $null
            open_ports = @()
            detection_method = 'collector-host, local-interface'
            is_collector = $true
            collector_hostname = $env:COMPUTERNAME
            local_ip = $iface.IP
            interface_alias = $iface.Alias
            status = 'active'
            notes = 'Maquina coletora da descoberta de rede.'
        }
    }

    foreach ($ip in ($activeIps | Sort-Object)) {
        $openPorts = @()
        foreach ($port in $ScanPorts) {
            if (Test-TcpPort -Ip $ip -Port $port -Timeout $TimeoutMs) {
                $openPorts += $port
            }
        }

        $mac = $arp[$ip]
        $vendor = Get-MacVendor $mac
        $hostname = Resolve-Hostname $ip
        $model = $null
        $modelSource = $null
        $methods = @('arp')

        if ($openPorts.Count -gt 0) { $methods += 'tcp-port-scan' }
        if ($vendor) { $methods += 'mac-vendor' }
        if ($openPorts -contains 9100) { $methods += 'printer-port-9100' }
        if ($openPorts -contains 631) { $methods += 'printer-port-631' }
        if ($openPorts -contains 515) { $methods += 'printer-port-515' }
        if ($openPorts -contains 161) {
            $model = Get-SnmpModel $ip
            if ($model) {
                $model = ConvertFrom-HtmlText $model
                $modelSource = 'snmp'
                $methods += 'snmp'
            }
        }
        if (-not $model -and ($openPorts -contains 80 -or $openPorts -contains 443)) {
            $model = Get-HttpModel -Ip $ip -OpenPorts $openPorts
            if ($model) {
                $modelSource = 'http-title'
                $methods += 'http-title'
            }
        }

        $deviceType = Get-DeviceType -OpenPorts $openPorts -Vendor $vendor -Hostname $hostname -PrinterModel $model -ModelSource $modelSource
        if ($deviceType -ne 'printer' -and $deviceType -ne 'media_device') { $model = $null }
        if ($deviceType -eq 'media_device') {
            $methods += 'probable-iot'
            $methods += 'probable-media-device'
        }

        $assets += [ordered]@{
            ip_address = $ip
            mac_address = $mac
            hostname = $hostname
            vendor = $vendor
            device_type = $deviceType
            printer_model = if ($deviceType -eq 'printer' -or $deviceType -eq 'media_device') { $model } else { $null }
            open_ports = $openPorts
            detection_method = ($methods | Select-Object -Unique) -join ', '
            status = 'active'
            notes = if ($deviceType -eq 'printer') { 'Possivel impressora detectada por porta de impressao, SNMP ou fabricante com sinal forte.' } elseif ($deviceType -eq 'media_device') { 'Possivel dispositivo IoT ou multimidia identificado por fabricante MAC.' } else { $null }
        }
    }

    $payload = [ordered]@{
        cliente = $Cliente
        collector_hostname = $env:COMPUTERNAME
        subnet = (($scanPlans | ForEach-Object { $_.Subnet }) -join ', ')
        selected_interfaces = @($scanPlans | ForEach-Object { "$($_.Alias) $($_.IP) $($_.Subnet)" })
        ignored_interfaces = @($ignoredInterfaces | ForEach-Object { "$($_.Alias) $($_.IP) $($_.Reason)" })
        collected_at = (Get-Date).ToUniversalTime().ToString("o")
        assets = $assets
    }

    if (-not [string]::IsNullOrWhiteSpace($ClientId)) {
        $payload['client_id'] = $ClientId
    }

    $json = $payload | ConvertTo-Json -Depth 8

    if ($DryRun) {
        Write-Output $json
        exit 0
    }

    Write-Output "Enviando dados para API..."
    Write-Output "Enviando $($assets.Count) ativo(s) descoberto(s) para $ApiUrl..."
    $response = Invoke-RestMethod -Uri $ApiUrl -Method Post -Body $json -ContentType "application/json; charset=utf-8" -Headers @{"x-agent-token" = $AgentToken} -TimeoutSec 30
    Write-Output "Sucesso: $($response.message)"
} catch {
    Write-Error "Falha na descoberta de rede: $($_.Exception.Message)"
    exit 1
}
