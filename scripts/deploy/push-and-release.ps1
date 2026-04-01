param(
  [string]$Branch = "main",
  [string]$Repo = "clgnuza/uzaedu"
)
$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
Set-Location $Root
Write-Host "Push $Branch ..."
git push origin $Branch
if (Get-Command gh -ErrorAction SilentlyContinue) {
  Write-Host "Trigger workflow deploy-production.yml ..."
  gh workflow run deploy-production.yml --repo $Repo --ref $Branch
} else {
  Write-Warning "GitHub CLI (gh) missing: install from https://cli.github.com or run workflow manually in Actions."
}