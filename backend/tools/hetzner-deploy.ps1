#Requires -Version 5.1
<#
  Hetzner: SSH ile sunucuda scripts/deploy/server-deploy.sh çalıştırır.
  Ortam (DEPLOY_SSH_HOST yoksa api.uzaedu.com A kaydı):
    $env:DEPLOY_SSH_USER = "root"
    $env:DEPLOY_SSH_KEY  = "$env:USERPROFILE\.ssh\id_rsa_uzaedu"
    $env:DEPLOY_REMOTE_ROOT = "/opt/uzaedu"

  Kullanım:
    cd backend
    .\tools\hetzner-deploy.ps1
#>
$ErrorActionPreference = "Stop"

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
if (-not (Test-Path $key)) { throw "SSH anahtar yok: $key" }

$remoteRoot = if ($env:DEPLOY_REMOTE_ROOT) { $env:DEPLOY_REMOTE_ROOT } else { "/opt/uzaedu" }
$sshTarget = "${user}@${hostAddr}"
$script = "$remoteRoot/scripts/deploy/server-deploy.sh"

Write-Host "SSH $sshTarget -> bash $script"
& ssh -i $key -o BatchMode=yes -o StrictHostKeyChecking=accept-new $sshTarget "chmod +x $script 2>/dev/null; bash $script"
if ($LASTEXITCODE -ne 0) { throw "SSH deploy cikis kodu: $LASTEXITCODE" }
$pw = "$remoteRoot/backend/tools/server-playwright-install.sh"
Write-Host "SSH $sshTarget -> Playwright chromium (MEB Mebbis)"
& ssh -i $key -o BatchMode=yes -o StrictHostKeyChecking=accept-new $sshTarget "chmod +x $pw 2>/dev/null; bash $pw"
if ($LASTEXITCODE -ne 0) { throw "Playwright kurulum cikis kodu: $LASTEXITCODE" }
Write-Host "Tamam."
