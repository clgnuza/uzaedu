# AVD içinden host PC'deki Next (web-admin) — emülatörde 10.0.2.2 = bilgisayarın localhost'u.
# Önkoşul: web-admin `npm run dev` (3000), backend ayakta; `adb devices` → device/emulator `device` olmalı.
$ErrorActionPreference = 'Stop'
$adb = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
if (-not (Test-Path $adb)) { throw "adb bulunamadı: $adb — Android SDK platform-tools kurulu mu?" }
$url = if ($args[0]) { $args[0] } else { 'http://10.0.2.2:3000/' }
& $adb shell am start -a android.intent.action.VIEW -d $url
