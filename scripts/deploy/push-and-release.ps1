#Requires -Version 5.1
<#
  main -> origin push; GitHub Actions "Deploy production" tetiklenir (paths: backend, web-admin, scripts/deploy).
  gh CLI yoksa: push sonrası https://github.com/clgnuza/uzaedu/actions/workflows/deploy-production.yml
#>
$ErrorActionPreference = "Stop"
Set-Location (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent)
git push origin main
Write-Host "Push tamam. Actions: https://github.com/clgnuza/uzaedu/actions/workflows/deploy-production.yml"