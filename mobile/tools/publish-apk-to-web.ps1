#Requires -Version 5.1
<#
  Release APK üretir ve web-admin/public/downloads/ altına kopyalar.
  Sonra: web-admin deploy veya sunucuda dosyayı /opt/uzaedu/web-admin/public/downloads/ konumuna koyun.

  Kullanım:
    Set-Location c:\UzaMobil\ogretmenpro\mobile
    .\tools\publish-apk-to-web.ps1
#>
$ErrorActionPreference = 'Stop'

$mobileRoot = Split-Path $PSScriptRoot -Parent
$repoRoot = Split-Path $mobileRoot -Parent
$outDir = Join-Path $repoRoot 'web-admin\public\downloads'
$outApk = Join-Path $outDir 'uzaedu-optik.apk'

if (-not (Get-Command flutter -ErrorAction SilentlyContinue)) {
  throw 'flutter CLI bulunamadi. PATH veya Flutter SDK kurulumunu kontrol edin.'
}

Set-Location $mobileRoot
Write-Host 'flutter build apk --release ...'
flutter build apk --release
if ($LASTEXITCODE -ne 0) { throw "flutter build cikis: $LASTEXITCODE" }

$built = Join-Path $mobileRoot 'build\app\outputs\flutter-apk\app-release.apk'
if (-not (Test-Path $built)) { throw "APK yok: $built" }

New-Item -ItemType Directory -Force -Path $outDir | Out-Null
Copy-Item -Force $built $outApk
$mb = [math]::Round((Get-Item $outApk).Length / 1MB, 1)
Write-Host "OK -> $outApk ($mb MB)"
Write-Host 'Canli: scp veya deploy sonrasi https://uzaedu.com/downloads/uzaedu-optik.apk'
