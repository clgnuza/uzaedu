#Requires -Version 5.1
<#
  Canli: PWA push + WebAuthn + passkey_login_enabled migration (tek tek, idempotent).
  Kullanım: cd backend; .\tools\prod-migrate-pwa-passkey.ps1
#>
$ErrorActionPreference = "Stop"

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
$sshTarget = "${user}@${hostAddr}"

$migrations = @(
  "migrations/add-push-subscriptions.sql",
  "migrations/add-notification-push-settings.sql",
  "migrations/add-webauthn-credentials.sql",
  "migrations/add-webauthn-challenges.sql",
  "migrations/add-passkey-login-enabled.sql"
)

foreach ($m in $migrations) {
  $cmd = "cd $remoteRoot/backend && node tools/run-single-migration.js $m"
  Write-Host "SSH -> $cmd"
  & ssh -i $key -o BatchMode=yes -o StrictHostKeyChecking=accept-new $sshTarget $cmd
  if ($LASTEXITCODE -ne 0) { throw "Migration basarisiz: $m (cikis $LASTEXITCODE)" }
}
Write-Host "Tum PWA/passkey migrationlari OK."
