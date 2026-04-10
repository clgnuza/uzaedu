#Requires -Version 5.1
<#
  Yerel backend/.env içindeki FIREBASE_* değerlerini sunucu backend/.env ile birleştirir; pm2 restart.

  Firebase Console → Project settings → Service accounts → Generate new private key (JSON):
    project_id → FIREBASE_PROJECT_ID
    client_email → FIREBASE_CLIENT_EMAIL
    private_key → FIREBASE_PRIVATE_KEY (tek satır, \\n ile)

  Ortam (web-admin sync-prod-env-to-remote.ps1 ile uyumlu):
    $env:DEPLOY_SSH_HOST — yoksa api.uzaedu.com A kaydı
    $env:DEPLOY_SSH_USER, DEPLOY_SSH_KEY, DEPLOY_REMOTE_ROOT

  Kullanım:
    cd backend
    .\tools\sync-firebase-env-to-remote.ps1
#>
$ErrorActionPreference = "Stop"
$backendRoot = Split-Path $PSScriptRoot -Parent
$envFile = Join-Path $backendRoot ".env"
if (-not (Test-Path $envFile)) { throw "backend/.env bulunamadı: $envFile" }

function Get-EnvLineValue([string[]]$lines, [string]$key) {
  $prefix = $key + "="
  foreach ($line in $lines) {
    $t = $line.Trim()
    if ($t.StartsWith("#") -or -not $t) { continue }
    if ($t.StartsWith($prefix)) {
      $v = $t.Substring($prefix.Length).Trim()
      if (($v.StartsWith('"') -and $v.EndsWith('"')) -or ($v.StartsWith("'") -and $v.EndsWith("'"))) {
        $v = $v.Substring(1, $v.Length - 2)
      }
      return $v
    }
  }
  return $null
}

$lines = Get-Content $envFile -Encoding UTF8
$fp = Get-EnvLineValue $lines "FIREBASE_PROJECT_ID"
$fe = Get-EnvLineValue $lines "FIREBASE_CLIENT_EMAIL"
$fk = Get-EnvLineValue $lines "FIREBASE_PRIVATE_KEY"
if (-not $fp) { throw "FIREBASE_PROJECT_ID backend/.env içinde yok veya boş." }
if (-not $fe) { throw "FIREBASE_CLIENT_EMAIL backend/.env içinde yok veya boş." }
if (-not $fk) { throw "FIREBASE_PRIVATE_KEY backend/.env içinde yok veya boş." }

$hostAddr = $env:DEPLOY_SSH_HOST
if (-not $hostAddr) {
  try {
    $ans = Resolve-DnsName -Name "api.uzaedu.com" -Type A -ErrorAction Stop | Where-Object { $_.IPAddress } | Select-Object -First 1
    if ($ans) { $hostAddr = $ans.IPAddress }
  } catch { }
}
if (-not $hostAddr) { throw "DEPLOY_SSH_HOST yok ve api.uzaedu.com DNS çözülemedi." }
$user = if ($env:DEPLOY_SSH_USER) { $env:DEPLOY_SSH_USER } else { "root" }
$key = if ($env:DEPLOY_SSH_KEY) { $env:DEPLOY_SSH_KEY } else { Join-Path $env:USERPROFILE ".ssh\id_rsa_uzaedu" }
$remoteRoot = if ($env:DEPLOY_REMOTE_ROOT) { $env:DEPLOY_REMOTE_ROOT } else { "/opt/uzaedu" }
$remoteEnv = "$remoteRoot/backend/.env"
$sshTarget = "${user}@${hostAddr}"

function Escape-PemForPatchLine([string]$s) {
  $n = $s -replace "`r`n", "`n" -replace "`r", "`n"
  return ($n -replace "`n", '\n')
}

$patchLines = @(
  "FIREBASE_PROJECT_ID=$fp",
  "FIREBASE_CLIENT_EMAIL=$fe",
  "FIREBASE_PRIVATE_KEY=$(Escape-PemForPatchLine $fk)"
)
$patchTmp = [System.IO.Path]::GetTempFileName()
Set-Content -Path $patchTmp -Value ($patchLines -join "`n") -Encoding UTF8 -NoNewline
Add-Content -Path $patchTmp -Value "" -Encoding UTF8

$applyPy = Join-Path $PSScriptRoot "sync-deploy-env-remote-apply.py"
$patchRemote = "/tmp/uzaedu-firebase-patch.env"
$applyRemote = "/tmp/sync-deploy-env-remote-apply.py"

Write-Host "SCP Firebase patch -> $sshTarget"
& scp -i $key -o BatchMode=yes -o StrictHostKeyChecking=accept-new $patchTmp "${sshTarget}:${patchRemote}"
& scp -i $key -o BatchMode=yes -o StrictHostKeyChecking=accept-new $applyPy "${sshTarget}:${applyRemote}"

$remoteCmd = "python3 $applyRemote $patchRemote $remoteEnv && rm -f $patchRemote $applyRemote && pm2 restart uzaedu-api --update-env && pm2 save"
Write-Host "Uygula + pm2 restart uzaedu-api..."
& ssh -i $key -o BatchMode=yes $sshTarget $remoteCmd

Remove-Item $patchTmp -Force -ErrorAction SilentlyContinue
Write-Host "Tamam. Log: pm2 logs uzaedu-api --lines 30 (Firebase Admin hazir olmali)."
