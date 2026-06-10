# AVD: PWA icin adb reverse + localhost (10.0.2.2 HTTP guvenli baglam degil, SW/install kapali).
# Onkosul: web-admin npm run dev (3000); adb devices -> device
$ErrorActionPreference = 'Stop'
$adb = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
if (-not (Test-Path $adb)) { throw "adb bulunamadi: $adb" }
& $adb reverse tcp:3000 tcp:3000 | Out-Null
$url = if ($args[0]) { $args[0] } else { 'http://localhost:3000/uygulama' }
& $adb shell am start -a android.intent.action.VIEW -d $url
