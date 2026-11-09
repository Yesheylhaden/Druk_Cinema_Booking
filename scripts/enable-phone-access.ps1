#Requires -RunAsAdministrator
[CmdletBinding()]
param([string]$ListenAddress)
$ErrorActionPreference = 'Stop'
if (-not $ListenAddress) {
    $ListenAddress = Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' } | ForEach-Object { $_.IPv4Address.IPAddress } | Select-Object -First 1
}
$parsedAddress = $null
if (-not [System.Net.IPAddress]::TryParse($ListenAddress, [ref]$parsedAddress) -or $parsedAddress.AddressFamily -ne [System.Net.Sockets.AddressFamily]::InterNetwork) { throw 'Connect to Wi-Fi or pass -ListenAddress with your computer IPv4 address.' }
$wslOutput = & wsl.exe -d Ubuntu hostname -I
if ($LASTEXITCODE -ne 0) { throw 'Could not get the Ubuntu network address.' }
$wslAddress = ($wslOutput.Trim() -split '\s+')[0]
$parsedWslAddress = $null
if (-not [System.Net.IPAddress]::TryParse($wslAddress, [ref]$parsedWslAddress)) { throw 'Invalid Ubuntu address.' }
& netsh.exe interface portproxy add v4tov4 listenaddress=$ListenAddress listenport=5173 connectaddress=$wslAddress connectport=5173
if ($LASTEXITCODE -ne 0) { throw 'Could not configure Windows port forwarding.' }
$ruleName = 'DrukCinemaFrontend5173'
Get-NetFirewallRule -Name $ruleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule -Name $ruleName -DisplayName 'Druk Cinema frontend - local network' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 5173 -LocalAddress $ListenAddress -RemoteAddress LocalSubnet -Profile Any | Out-Null
$projectPath = Split-Path $PSScriptRoot -Parent
$envPath = Join-Path $projectPath '.env'
if (-not (Test-Path -LiteralPath $envPath)) { throw 'Create the project .env first.' }
$existingLines = [System.IO.File]::ReadAllLines($envPath)
$origins = @('http://localhost:5173','http://127.0.0.1:5173',"http://${ListenAddress}:5173")
foreach ($line in $existingLines) { if ($line.StartsWith('FRONTEND_ORIGIN=')) { $origins += $line.Substring(16).Split(',') } }
$updatedLines = @($existingLines | Where-Object { -not $_.StartsWith('PUBLIC_APP_URL=') -and -not $_.StartsWith('FRONTEND_ORIGIN=') })
$updatedLines += "PUBLIC_APP_URL=http://${ListenAddress}:5173"
$updatedLines += 'FRONTEND_ORIGIN=' + (($origins | Select-Object -Unique) -join ',')
[System.IO.File]::WriteAllLines($envPath,$updatedLines,[System.Text.UTF8Encoding]::new($false))
Write-Host "Windows forwarding configured: http://${ListenAddress}:5173"
Write-Host 'In your Ubuntu project terminal, run: docker compose up --no-build -d'
Write-Host 'Keep npm run dev running. Connect the phone to the same Wi-Fi, refresh the booking page and download new PDFs.'
