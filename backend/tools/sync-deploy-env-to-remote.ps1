#Requires -Version 5.1
<#
  Yerel backend/.env içindeki DEPLOY_ENABLED, DEPLOY_SECRET, DEPLOY_SCRIPT_PATH değerlerini
  canlı sunucudaki backend/.env ile birleştirir; ardından pm2 restart.

  Ortam (deploy-local-to-prod.ps1 ile aynı):
    $env:DEPLOY_SSH_HOST = "..."
    $env:DEPLOY_SSH_USER = "root"
    $env:DEPLOY_SSH_KEY  = "$env:USERPROFILE\.ssh\id_rsa_uzaedu"
    $env:DEPLOY_REMOTE_ROOT = "/opt/uzaedu"

  Kullanım:
    cd backend
    .\tools\sync-deploy-env-to-remote.ps1
#>
$ErrorActionPreference = "Stop"
$backendRoot = Split-Path $PSScriptRoot -Parent
$envFile = Join-Path $backendRoot ".env"
if (-not (Test-Path $envFile)) { throw "backend/.env bulunamadı: $envFile" }

function Get-EnvValue([string]$rawContent, [string]$key) {
  $m = [regex]::Match($rawContent, "(?m)^" + [regex]::Escape($key) + "=(.*)$")
  if (-not $m.Success) { return $null }
  return $m.Groups[1].Value.Trim()
}

$raw = Get-Content $envFile -Raw -Encoding UTF8
$depSecret = Get-EnvValue $raw "DEPLOY_SECRET"
$depEnabled = Get-EnvValue $raw "DEPLOY_ENABLED"
$depScript = Get-EnvValue $raw "DEPLOY_SCRIPT_PATH"
if (-not $depSecret) { throw "DEPLOY_SECRET backend/.env içinde tanımlı değil." }
if (-not $depEnabled) { $depEnabled = "true" }
if (-not $depScript) { $depScript = "/opt/uzaedu/scripts/deploy/server-deploy.sh" }

$hostAddr = $env:DEPLOY_SSH_HOST
if (-not $hostAddr) { throw "DEPLOY_SSH_HOST ortam değişkeni gerekli." }
$user = if ($env:DEPLOY_SSH_USER) { $env:DEPLOY_SSH_USER } else { "root" }
$key = if ($env:DEPLOY_SSH_KEY) { $env:DEPLOY_SSH_KEY } else { Join-Path $env:USERPROFILE ".ssh\id_rsa_uzaedu" }
$remoteRoot = if ($env:DEPLOY_REMOTE_ROOT) { $env:DEPLOY_REMOTE_ROOT } else { "/opt/uzaedu" }
$remoteEnv = "$remoteRoot/backend/.env"
$sshTarget = "${user}@${hostAddr}"

$patchLines = @(
  "DEPLOY_ENABLED=$depEnabled",
  "DEPLOY_SECRET=$depSecret",
  "DEPLOY_SCRIPT_PATH=$depScript"
)
$patchTmp = [System.IO.Path]::GetTempFileName()
Set-Content -Path $patchTmp -Value ($patchLines -join "`n") -Encoding UTF8 -NoNewline
Add-Content -Path $patchTmp -Value "" -Encoding UTF8

$applyPy = Join-Path $PSScriptRoot "sync-deploy-env-remote-apply.py"
$patchRemote = "/tmp/uzaedu-deploy-patch.env"
$applyRemote = "/tmp/sync-deploy-env-remote-apply.py"

Write-Host "SCP patch + apply script -> $sshTarget"
& scp -i $key -o BatchMode=yes -o StrictHostKeyChecking=accept-new $patchTmp "${sshTarget}:${patchRemote}"
& scp -i $key -o BatchMode=yes -o StrictHostKeyChecking=accept-new $applyPy "${sshTarget}:${applyRemote}"

$remoteCmd = "python3 $applyRemote $patchRemote $remoteEnv && rm -f $patchRemote $applyRemote && (pm2 reload uzaedu-api --update-env || pm2 restart uzaedu-api --update-env) && pm2 save"
Write-Host "Uygula + pm2 reload..."
& ssh -i $key -o BatchMode=yes $sshTarget $remoteCmd

Remove-Item $patchTmp -Force -ErrorAction SilentlyContinue
Write-Host "Tamam."
