#Requires -Version 5.1
<#
  Canlı: önce bakım modu aç → Hetzner deploy → başarılıysa bakım kapat.
  Ortam:
    PROD_SUPERADMIN_TOKEN  (zorunlu) — süperadmin JWT, PATCH /app-config/web-extras için
    PROD_API_BASE          (isteğe bağlı) — varsayılan https://api.uzaedu.com/api
    DEPLOY_MAINTENANCE_WAIT_SEC — bakım açıldıktan sonra bekleme (varsayılan 15, edge önbellek ~12s)
  Hetzner SSH: hetzner-deploy.ps1 ile aynı (DEPLOY_SSH_HOST, DEPLOY_SSH_KEY, …).

  Kullanım:
    cd backend
    $env:PROD_SUPERADMIN_TOKEN = "eyJ..."
    .\tools\hetzner-deploy-maintained.ps1

  Sadece deploy (bakım yok): .\tools\hetzner-deploy-maintained.ps1 -SkipMaintenance
#>
param(
  [switch]$SkipMaintenance
)

$ErrorActionPreference = "Stop"

$apiBase = "https://api.uzaedu.com/api"
if ($env:PROD_API_BASE -and $env:PROD_API_BASE.Trim()) {
  $apiBase = $env:PROD_API_BASE.Trim().TrimEnd("/")
}
$waitSec = 15
if ($env:DEPLOY_MAINTENANCE_WAIT_SEC -match '^\d+$') { $waitSec = [int]$env:DEPLOY_MAINTENANCE_WAIT_SEC }

function Set-ProdMaintenance {
  param(
    [Parameter(Mandatory = $true)][bool]$Enabled
  )
  $token = $env:PROD_SUPERADMIN_TOKEN
  if (-not $token) { throw "PROD_SUPERADMIN_TOKEN tanimli degil." }
  $uri = "$apiBase/app-config/web-extras"
  $payload = @{ maintenance_enabled = $Enabled }
  if ($Enabled -and $env:PROD_MAINTENANCE_MESSAGE_HTML) {
    $payload.maintenance_message_html = $env:PROD_MAINTENANCE_MESSAGE_HTML
  }
  $json = $payload | ConvertTo-Json -Compress
  $headers = @{
    Authorization  = "Bearer $token"
    "Content-Type" = "application/json"
  }
  Invoke-RestMethod -Uri $uri -Method Patch -Headers $headers -Body $json -TimeoutSec 60 -ErrorAction Stop | Out-Null
  Write-Host "[maint] maintenance_enabled=$Enabled OK ($uri)"
}

$deployScript = Join-Path $PSScriptRoot "hetzner-deploy.ps1"
if (-not (Test-Path $deployScript)) { throw "hetzner-deploy.ps1 bulunamadi: $deployScript" }

if ($SkipMaintenance) {
  Write-Host "[maint] SkipMaintenance — dogrudan deploy."
  & $deployScript
  exit $LASTEXITCODE
}

$maintWasEnabled = $false
try {
  Write-Host "[maint] Bakim aciliyor..."
  Set-ProdMaintenance -Enabled $true
  $maintWasEnabled = $true
  Write-Host "[maint] $($waitSec)s bekleniyor (edge/onbellek)..."
  Start-Sleep -Seconds $waitSec

  & $deployScript
  if ($LASTEXITCODE -ne 0) { throw "hetzner-deploy.ps1 cikis: $LASTEXITCODE" }

  Write-Host "[maint] Deploy basarili — bakim kapatiliyor..."
  $lastErr = $null
  for ($i = 1; $i -le 3; $i++) {
    try {
      Set-ProdMaintenance -Enabled $false
      $lastErr = $null
      break
    }
    catch {
      $lastErr = $_
      Write-Host "[maint] Bakim kapatma denemesi $i/3 basarisiz: $($_.Exception.Message)"
      if ($i -lt 3) { Start-Sleep -Seconds 2 }
    }
  }
  if ($null -ne $lastErr) { throw "Bakim kapatilamadi (3 deneme): $($lastErr.Exception.Message)" }

  Write-Host "[maint] Tamam."
  exit 0
}
catch {
  Write-Host "[maint] HATA: $($_.Exception.Message)" -ForegroundColor Red
  if ($maintWasEnabled) {
    Write-Host "[maint] Bakim modu acik kaldi; token ile manuel kapat: PATCH $apiBase/app-config/web-extras { `"maintenance_enabled`": false }"
  }
  exit 1
}
