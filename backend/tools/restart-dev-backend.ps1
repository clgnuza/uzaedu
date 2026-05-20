# Tek backend örneği — 4000 portunu boşaltıp start:dev başlatır
$port = if ($env:APP_PORT) { [int]$env:APP_PORT } else { 4000 }
Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Set-Location $PSScriptRoot\..
npm run start:dev
