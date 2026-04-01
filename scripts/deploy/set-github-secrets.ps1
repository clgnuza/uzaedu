<#
  GitHub Actions deploy icin repo Secrets yazar (gh CLI).
  Kullanim:
    gh auth login
    .\scripts\deploy\set-github-secrets.ps1 -DeployHost "SUNUCU_IP" -DeployUser "root" -KeyPath "$env:USERPROFILE\.ssh\id_rsa_uzaedu"
  Parametresiz: interaktif sorar.
#>
[CmdletBinding()]
param(
  [string]$Repo = "clgnuza/uzaedu",
  [Alias("Host")]
  [string]$DeployHost,
  [string]$DeployUser = "root",
  [string]$KeyPath = "",
  [switch]$WhatIf
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  Write-Error "GitHub CLI yok. winget install GitHub.cli"
}

$null = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Error "Once: gh auth login"
}

if (-not $DeployHost) {
  $DeployHost = Read-Host "DEPLOY_SSH_HOST (sunucu IPv4 veya hostname)"
}
if (-not $DeployUser) {
  $DeployUser = Read-Host "DEPLOY_SSH_USER [root]"
}
if ([string]::IsNullOrWhiteSpace($KeyPath)) {
  $def = Join-Path $env:USERPROFILE ".ssh\id_rsa_uzaedu"
  $in = Read-Host "Ozel anahtar dosyasi [$def]"
  if ([string]::IsNullOrWhiteSpace($in)) { $KeyPath = $def } else { $KeyPath = $in }
}

if (-not (Test-Path -LiteralPath $KeyPath)) {
  Write-Error "Anahtar bulunamadi: $KeyPath"
}

Write-Host "Repo: $Repo"
Write-Host "Host: $DeployHost  User: $DeployUser  Key: $KeyPath"
if ($WhatIf) {
  Write-Host "WhatIf: gh secret set ..."
  exit 0
}

$DeployHost | gh secret set DEPLOY_SSH_HOST --repo $Repo
$DeployUser | gh secret set DEPLOY_SSH_USER --repo $Repo
Get-Content -LiteralPath $KeyPath -Raw | gh secret set DEPLOY_SSH_KEY --repo $Repo

Write-Host "Tamam. Kontrol: https://github.com/$Repo/settings/secrets/actions"
Write-Host "Deploy: Actions - Deploy production - Run workflow"