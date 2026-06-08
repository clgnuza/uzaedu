#Requires -Version 5.1
<#
  Canlı deploy sonrası anasayfa smoke testi.
  Ortam: PROD_SITE_URL (varsayılan https://uzaedu.com)
#>
param(
  [string]$SiteUrl = $(if ($env:PROD_SITE_URL) { $env:PROD_SITE_URL.Trim().TrimEnd('/') } else { 'https://uzaedu.com' }),
  [int]$TimeoutSec = 30
)

$ErrorActionPreference = 'Stop'

$markers = @(
  'Uzaedu',
  'Tek ekosistem',
  'landing-page',
  'landing-seal-hub',
  'landing-features-grid',
  '/register'
)

Write-Host ('[verify] GET ' + $SiteUrl + '/')
$r = Invoke-WebRequest -Uri "$SiteUrl/" -UseBasicParsing -TimeoutSec $TimeoutSec -MaximumRedirection 5
if ($r.StatusCode -ne 200) {
  throw "Anasayfa HTTP $($r.StatusCode) (beklenen 200)"
}

$html = [string]$r.Content
if ($html -match 'Sistem güncelleniyor|bakim-card|bakim-title|maintenance_enabled') {
  throw 'Anasayfa bakim modu icerigi gosteriyor olabilir.'
}

try {
  $apiBase = if ($env:PROD_API_BASE) { $env:PROD_API_BASE.Trim().TrimEnd('/') } else { 'https://api.uzaedu.com/api' }
  $extras = Invoke-RestMethod -Uri "$apiBase/content/web-extras" -TimeoutSec 15
  if ($extras.maintenance_enabled -eq $true) {
    throw 'API maintenance_enabled=true'
  }
} catch {
  if ($_.Exception.Message -match 'maintenance_enabled') { throw }
}

$missing = @($markers | Where-Object { $html -notmatch [regex]::Escape($_) })
if ($missing.Count -gt 0) {
  throw "Anasayfa eksik icerik: $($missing -join ', ')"
}

Write-Host ('[verify] Anasayfa OK (' + $SiteUrl + '/)')
exit 0
