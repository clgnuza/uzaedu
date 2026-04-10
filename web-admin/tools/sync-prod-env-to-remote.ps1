#Requires -Version 5.1
<#
  Yerel web-admin/.env.production -> sunucu /opt/uzaedu/web-admin/.env.production (SCP).
  Sonra sunucuda web yeniden build: scripts/deploy/server-deploy.sh veya panel deploy.

  Ortam (DEPLOY_SSH_HOST yoksa api.uzaedu.com A kaydı kullanılır — Hetzner):
    $env:DEPLOY_SSH_HOST = "..."   # isteğe bağlı
    $env:DEPLOY_SSH_USER = "root"
    $env:DEPLOY_SSH_KEY  = "$env:USERPROFILE\.ssh\id_rsa_uzaedu"
    $env:DEPLOY_REMOTE_ROOT = "/opt/uzaedu"

  Kullanım:
    cd web-admin
    .\tools\sync-prod-env-to-remote.ps1
#>
$ErrorActionPreference = "Stop"
$webRoot = Split-Path $PSScriptRoot -Parent
$localEnv = Join-Path $webRoot ".env.production"
if (-not (Test-Path $localEnv)) { throw "web-admin/.env.production yok. Önce Firebase + NEXT_PUBLIC_* ile oluşturun." }

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
$remotePath = "$remoteRoot/web-admin/.env.production"
$sshTarget = "${user}@${hostAddr}"

Write-Host "SCP .env.production -> ${sshTarget}:${remotePath}"
& scp -i $key -o BatchMode=yes -o StrictHostKeyChecking=accept-new $localEnv "${sshTarget}:${remotePath}"
Write-Host "Tamam. Sunucuda: cd $remoteRoot && bash scripts/deploy/server-deploy.sh (veya panel Sunucuyu güncelle)."
