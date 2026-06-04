# Yerel Chrome — ayri profilde eklenti (normal acik Chrome --load-extension yok sayar)
$ErrorActionPreference = 'Stop'
$extPath = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$profile = Join-Path $env:TEMP 'uzaedu-chrome-ext-dev'

$chrome = @(
  "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $chrome) { throw 'Chrome bulunamadi. https://www.google.com/chrome/ kurun.' }

if (-not (Test-Path (Join-Path $extPath 'manifest.json'))) {
  throw "manifest.json yok: $extPath"
}

Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -and $_.CommandLine -like '*uzaedu-chrome-ext-dev*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

Start-Sleep -Milliseconds 600
New-Item -ItemType Directory -Force -Path $profile | Out-Null
Set-Clipboard -Value $extPath

# chrome:// icin mutlaka chrome.exe — cmd "start chrome://..." Windows hatasi verir
$launchArgs = @(
  "--user-data-dir=$profile",
  "--remote-debugging-port=9222",
  "--load-extension=$extPath",
  '--no-first-run',
  '--no-default-browser-check',
  'chrome://extensions/',
  'http://localhost:3000/login/okul',
  'https://e-okul.meb.gov.tr/'
)

Start-Process -FilePath $chrome -ArgumentList $launchArgs | Out-Null

Write-Host ''
Write-Host 'Chrome acildi (profil: uzaedu-chrome-ext-dev).'
Write-Host "Eklenti klasoru (panoda): $extPath"
Write-Host 'extensions: Uzaedu Okul Koprusu gorunmeli.'
Write-Host 'Manuel: Gelistirici modu -> Paketlenmemis yukle -> panodaki klasor.'
