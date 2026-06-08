#Requires -Version 5.1
<#
  Canlı: önce bakım modu aç → Hetzner deploy → başarılıysa bakım kapat.
  Ortam:
    PROD_SUPERADMIN_TOKEN  (isteğe bağlı) — süperadmin JWT, PATCH /app-config/web-extras
    PROD_API_BASE          (isteğe bağlı) — varsayılan https://api.uzaedu.com/api
    DEPLOY_MAINTENANCE_WAIT_SEC — bakım açıldıktan sonra bekleme (varsayılan 15)
    PROD_MAINTENANCE_MESSAGE_HTML — bakım mesajı (API veya SSH DB)
  Token yoksa: sunucuda node tools/set-web-maintenance-remote.js (SSH, aynı anahtar hetzner-deploy.ps1)

  Kullanım:
    cd backend
    .\tools\hetzner-deploy-maintained.ps1

  Sadece deploy (bakım yok): .\tools\hetzner-deploy-maintained.ps1 -SkipMaintenance
#>
param(
  [switch]$SkipMaintenance
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "load-deploy-env.ps1")

$apiBase = "https://api.uzaedu.com/api"
if ($env:PROD_API_BASE -and $env:PROD_API_BASE.Trim()) {
  $apiBase = $env:PROD_API_BASE.Trim().TrimEnd("/")
}
$waitSec = 15
if ($env:DEPLOY_MAINTENANCE_WAIT_SEC -match '^\d+$') { $waitSec = [int]$env:DEPLOY_MAINTENANCE_WAIT_SEC }

function Get-DeploySshTarget {
  $hostAddr = $env:DEPLOY_SSH_HOST
  if (-not $hostAddr) {
    try {
      $ans = Resolve-DnsName -Name "api.uzaedu.com" -Type A -ErrorAction Stop | Where-Object { $_.IPAddress } | Select-Object -First 1
      if ($ans) { $hostAddr = $ans.IPAddress }
    } catch { }
  }
  if (-not $hostAddr) { throw "DEPLOY_SSH_HOST yok ve api.uzaedu.com DNS cozulemedi." }
  $user = if ($env:DEPLOY_SSH_USER) { $env:DEPLOY_SSH_USER } else { "root" }
  $key = if ($env:DEPLOY_SSH_KEY) { $env:DEPLOY_SSH_KEY } else { Join-Path $env:USERPROFILE ".ssh\id_rsa_uzaedu" }
  if (-not (Test-Path $key)) { throw "SSH anahtar yok: $key" }
  $remoteRoot = if ($env:DEPLOY_REMOTE_ROOT) { $env:DEPLOY_REMOTE_ROOT } else { "/opt/uzaedu" }
  return @{ Target = "${user}@${hostAddr}"; Key = $key; RemoteRoot = $remoteRoot }
}

function Set-ProdMaintenanceViaApi {
  param([Parameter(Mandatory = $true)][bool]$Enabled)
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
  Write-Host "[maint] maintenance_enabled=$Enabled OK (API $uri)"
}

function Set-ProdMaintenanceViaSsh {
  param([Parameter(Mandatory = $true)][bool]$Enabled)
  $ssh = Get-DeploySshTarget
  $flag = if ($Enabled) { 'true' } else { 'false' }
  $sql = "UPDATE app_config SET value = jsonb_set(COALESCE(value::jsonb, '{}'::jsonb), '{maintenance_enabled}', '$flag') WHERE key = 'web_extras_config';"
  $b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($sql))
  $cmd = "echo $b64 | base64 -d | docker exec -i ogretmenpro-db psql -U ogretmenpro -d ogretmenpro -v ON_ERROR_STOP=1"
  Write-Host "[maint] SSH $($ssh.Target) -> docker psql maintenance_enabled=$Enabled"
  & ssh -i $ssh.Key -o BatchMode=yes -o StrictHostKeyChecking=accept-new $ssh.Target $cmd
  if ($LASTEXITCODE -ne 0) { throw "SSH bakim komutu cikis: $LASTEXITCODE" }
  Write-Host "[maint] maintenance_enabled=$Enabled OK (SSH DB)"
}

function Set-ProdMaintenance {
  param([Parameter(Mandatory = $true)][bool]$Enabled)
  if ($env:PROD_SUPERADMIN_TOKEN) {
    Set-ProdMaintenanceViaApi -Enabled $Enabled
  } else {
    Write-Host "[maint] PROD_SUPERADMIN_TOKEN yok; SSH ile DB guncelleniyor..."
    Set-ProdMaintenanceViaSsh -Enabled $Enabled
  }
}

$deployScript = Join-Path $PSScriptRoot "hetzner-deploy.ps1"
if (-not (Test-Path $deployScript)) { throw "hetzner-deploy.ps1 bulunamadi: $deployScript" }

if ($SkipMaintenance) {
  Write-Host "[maint] SkipMaintenance - dogrudan deploy."
  try {
    & $deployScript
    exit $LASTEXITCODE
  } catch {
    exit 1
  }
}

$maintWasEnabled = $false
try {
  Write-Host "[maint] Bakim aciliyor..."
  Set-ProdMaintenance -Enabled $true
  $maintWasEnabled = $true
  Write-Host ('[maint] ' + $waitSec + ' sn bekleniyor, edge onbellek...')
  Start-Sleep -Seconds $waitSec

  & $deployScript
  if ($LASTEXITCODE -ne 0) { throw "hetzner-deploy.ps1 cikis: $LASTEXITCODE" }

  Write-Host "[maint] Deploy basarili - bakim kapatiliyor..."
  $lastErr = $null
  for ($i = 1; $i -le 3; $i++) {
    try {
      Set-ProdMaintenance -Enabled $false
      $lastErr = $null
      break
    } catch {
      $lastErr = $_
      Write-Host "[maint] Bakim kapatma denemesi $i/3 basarisiz: $($_.Exception.Message)"
      if ($i -lt 3) { Start-Sleep -Seconds 2 }
    }
  }
  if ($null -ne $lastErr) { throw "Bakim kapatilamadi (3 deneme): $($lastErr.Exception.Message)" }

  $verifyScript = Join-Path $PSScriptRoot "verify-prod-homepage.ps1"
  if (Test-Path $verifyScript) {
    Write-Host '[verify] Bakim kapali - anasayfa kontrolu...'
    & $verifyScript
    if ($LASTEXITCODE -ne 0) { throw "Anasayfa dogrulamasi basarisiz (cikis $LASTEXITCODE)" }
  }

  Write-Host "[maint] Tamam."
  exit 0
}
catch {
  Write-Host "[maint] HATA: $($_.Exception.Message)" -ForegroundColor Red
  if ($maintWasEnabled) {
    Write-Host "[maint] Bakim modu acik kaldi; kapat: .\tools\hetzner-deploy-maintained.ps1 yalnizca kapatma icin token/SSH ile PATCH veya: ssh ... node tools/set-web-maintenance-remote.js --off"
  }
  exit 1
}
