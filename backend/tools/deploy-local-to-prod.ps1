#Requires -Version 5.1
<#
  Yerel DB -> SQL dosyasi -> (istege bagli) SCP + canli psql import.
  Ortam (kullanici veya oturum):
    $env:DEPLOY_SSH_HOST = "178.104.x.x"
    $env:DEPLOY_SSH_USER = "root"
    $env:DEPLOY_SSH_KEY  = "$env:USERPROFILE\.ssh\id_rsa_uzaedu"
    $env:DEPLOY_REMOTE_ROOT = "/opt/uzaedu"
    # Varsayilan: app_config dislanir. Tam app_config icin: -IncludeAppConfig

  Ornek:
    .\deploy-local-to-prod.ps1
    .\deploy-local-to-prod.ps1 -ExportOnly
#>
param(
  [string] $OutFile = (Join-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) "data-mirror.sql"),
  [switch] $ExportOnly,
  [switch] $IncludeAppConfig
)

$ErrorActionPreference = "Stop"
$backendRoot = Split-Path $PSScriptRoot -Parent
Set-Location $backendRoot

$skipCfg = (-not $IncludeAppConfig) -or ($env:DEPLOY_SKIP_APP_CONFIG -eq "1")
if ($skipCfg) {
  & node tools/export-superadmin-full-sql.cjs $OutFile --skip-app-config
} else {
  & node tools/export-superadmin-full-sql.cjs $OutFile
}

Write-Host "Yazildi: $OutFile"
if ($ExportOnly) { exit 0 }

$hostAddr = $env:DEPLOY_SSH_HOST
if (-not $hostAddr) { throw "DEPLOY_SSH_HOST tanimli degil (veya -ExportOnly kullanin)." }
$user = if ($env:DEPLOY_SSH_USER) { $env:DEPLOY_SSH_USER } else { "root" }
$key = if ($env:DEPLOY_SSH_KEY) { $env:DEPLOY_SSH_KEY } else { Join-Path $env:USERPROFILE ".ssh\id_rsa_uzaedu" }
$remoteRoot = if ($env:DEPLOY_REMOTE_ROOT) { $env:DEPLOY_REMOTE_ROOT } else { "/opt/uzaedu" }
$remoteSql = "/tmp/data-mirror-import.sql"

$sshTarget = "${user}@${hostAddr}"
Write-Host "SCP -> ${sshTarget}:${remoteSql}"
& scp -i $key -o BatchMode=yes -o StrictHostKeyChecking=accept-new $OutFile "${sshTarget}:${remoteSql}"

$remoteCmd = "cd $remoteRoot && set -a && . backend/.env && set +a && cat $remoteSql | docker exec -i ogretmenpro-db psql -v ON_ERROR_STOP=1 -U `$DB_USERNAME -d `$DB_DATABASE && rm -f $remoteSql && pm2 restart uzaedu-api --update-env && pm2 save"

Write-Host "Import + pm2 restart..."
& ssh -i $key -o BatchMode=yes $sshTarget $remoteCmd
Write-Host "Tamam."
