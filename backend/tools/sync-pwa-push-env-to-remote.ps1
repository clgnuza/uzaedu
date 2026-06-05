#Requires -Version 5.1
<#
  VAPID + WebAuthn ortam değişkenlerini yerel backend/.env → canlı backend/.env
  Kullanım: cd backend; .\tools\sync-pwa-push-env-to-remote.ps1
#>
$ErrorActionPreference = "Stop"
$backendRoot = Split-Path $PSScriptRoot -Parent
$envFile = Join-Path $backendRoot ".env"
if (-not (Test-Path $envFile)) { throw "backend/.env bulunamadi: $envFile" }

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
$vapidPub = Get-EnvLineValue $lines "VAPID_PUBLIC_KEY"
$vapidPriv = Get-EnvLineValue $lines "VAPID_PRIVATE_KEY"
$vapidSub = Get-EnvLineValue $lines "VAPID_SUBJECT"
if (-not $vapidPub -or -not $vapidPriv) {
  throw "VAPID_PUBLIC_KEY ve VAPID_PRIVATE_KEY backend/.env icinde olmali (npx web-push generate-vapid-keys)."
}
if (-not $vapidSub) { $vapidSub = "mailto:uzaeduapp@gmail.com" }

$webauthnRp = Get-EnvLineValue $lines "WEBAUTHN_RP_ID"
if (-not $webauthnRp) { $webauthnRp = "uzaedu.com" }
$webauthnOrigins = Get-EnvLineValue $lines "WEBAUTHN_ORIGINS"
if (-not $webauthnOrigins) {
  $webauthnOrigins = "https://uzaedu.com,https://www.uzaedu.com,https://admin.uzaedu.com"
}
$webauthnName = Get-EnvLineValue $lines "WEBAUTHN_RP_NAME"
if (-not $webauthnName) { $webauthnName = "Uzaedu Ogretmen" }

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
$remoteRoot = if ($env:DEPLOY_REMOTE_ROOT) { $env:DEPLOY_REMOTE_ROOT } else { "/opt/uzaedu" }
$remoteEnv = "$remoteRoot/backend/.env"
$sshTarget = "${user}@${hostAddr}"

$patchLines = @(
  "VAPID_PUBLIC_KEY=$vapidPub",
  "VAPID_PRIVATE_KEY=$vapidPriv",
  "VAPID_SUBJECT=$vapidSub",
  "WEBAUTHN_RP_ID=$webauthnRp",
  "WEBAUTHN_ORIGINS=$webauthnOrigins",
  "WEBAUTHN_RP_NAME=$webauthnName"
)
$patchTmp = [System.IO.Path]::GetTempFileName()
Set-Content -Path $patchTmp -Value ($patchLines -join "`n") -Encoding UTF8 -NoNewline
Add-Content -Path $patchTmp -Value "" -Encoding UTF8

$applyPy = Join-Path $PSScriptRoot "sync-deploy-env-remote-apply.py"
$patchRemote = "/tmp/uzaedu-pwa-push-patch.env"
$applyRemote = "/tmp/sync-deploy-env-remote-apply.py"

Write-Host "SCP PWA/push patch -> $sshTarget"
& scp -i $key -o BatchMode=yes -o StrictHostKeyChecking=accept-new $patchTmp "${sshTarget}:${patchRemote}"
& scp -i $key -o BatchMode=yes -o StrictHostKeyChecking=accept-new $applyPy "${sshTarget}:${applyRemote}"

$remoteCmd = "python3 $applyRemote $patchRemote $remoteEnv && rm -f $patchRemote $applyRemote && (pm2 reload uzaedu-api --update-env || pm2 restart uzaedu-api --update-env) && pm2 save"
Write-Host "Uygula + pm2 reload uzaedu-api..."
& ssh -i $key -o BatchMode=yes $sshTarget $remoteCmd

Remove-Item $patchTmp -Force -ErrorAction SilentlyContinue
Write-Host "Tamam. Kontrol: curl -s https://api.uzaedu.com/api/push/vapid-public-key"
