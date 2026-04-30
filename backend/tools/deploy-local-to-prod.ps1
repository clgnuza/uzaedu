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

# BOM / CRLF güvenli: .env kaynaklamak yerine utf-8-sig ile oku
$importPy = @"
import shlex, subprocess
_SQL = r'$remoteSql'
_ROOT = r'$remoteRoot'
env = {}
with open(_ROOT + '/backend/.env', 'r', encoding='utf-8-sig') as f:
    for raw in f:
        line = raw.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        k, v = line.split('=', 1)
        env[k.strip()] = v.strip()
user = env.get('DB_USERNAME')
db = env.get('DB_DATABASE')
if not user or not db:
    raise SystemExit('DB_USERNAME/DB_DATABASE missing in ' + _ROOT + '/backend/.env')
cmd = 'cat ' + shlex.quote(_SQL) + ' | docker exec -i ogretmenpro-db psql -v ON_ERROR_STOP=1 -U ' + shlex.quote(user) + ' -d ' + shlex.quote(db)
subprocess.check_call(cmd, shell=True)
subprocess.check_call('rm -f ' + shlex.quote(_SQL), shell=True)
subprocess.check_call('pm2 reload uzaedu-api --update-env || pm2 restart uzaedu-api --update-env', shell=True)
subprocess.check_call('pm2 save', shell=True)
print('IMPORT_OK')
"@
$b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($importPy))

Write-Host "Import + pm2 reload..."
& ssh -i $key -o BatchMode=yes $sshTarget "echo $b64 | base64 -d | python3"
Write-Host "Tamam."
