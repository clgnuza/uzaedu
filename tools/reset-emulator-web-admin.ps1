# Emulator Chrome sifirla + localhost:3000 tek sefer ac (yenileme dongusu onlemi).
# Onkosul: web-admin npm run dev (3000); adb devices -> device
$ErrorActionPreference = 'Stop'
$adb = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
if (-not (Test-Path $adb)) { throw "adb bulunamadi: $adb" }

$dev = & $adb devices | Select-String 'device$'
if (-not $dev) { throw 'Emulator/cihaz bagli degil (adb devices).' }

$url = if ($args[0]) { $args[0] } else { 'http://localhost:3000/' }

Write-Host 'Chrome durduruluyor ve site verisi temizleniyor...'
& $adb shell am force-stop com.android.chrome | Out-Null
& $adb shell pm clear com.android.chrome | Out-Null

& $adb reverse --remove-all 2>$null | Out-Null
& $adb reverse tcp:3000 tcp:3000 | Out-Null
& $adb reverse tcp:4000 tcp:4000 | Out-Null

Write-Host "Aciliyor: $url"
& $adb shell am start -a android.intent.action.VIEW -d $url -n com.android.chrome/com.google.android.apps.chrome.Main
