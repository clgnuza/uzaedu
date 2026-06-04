# PWA splash + maskable — npm run pwa:assets
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
$root = Split-Path $PSScriptRoot -Parent
$srcIcon = Join-Path $root "public\icon-512.png"
$outDir = Join-Path $root "public\pwa"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
