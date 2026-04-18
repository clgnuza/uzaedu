# Uzaedu Öğretmen - Geliştirme ortamını başlat (run-order sırası)
# Kullanım: .\scripts\start-dev.ps1

$ErrorActionPreference = "Stop"

function Test-BackendUp {
  try {
    $resp = Invoke-WebRequest -Uri "http://localhost:4000/api" -Method Get -TimeoutSec 2 -ErrorAction Stop
    return $true
  } catch {
    # 404 gibi HTTP hataları da backend'in ayakta olduğuna işaret eder
    $msg = $_.Exception.Message
    if ($msg -and ($msg -like "*404*" -or $msg -like "*Cannot GET*")) { return $true }
    return $false
  }
}

Write-Host "1. Veritabanı başlatılıyor..." -ForegroundColor Cyan
docker start ogretmenpro-db 2>$null
if ($LASTEXITCODE -ne 0) { Write-Host "   ogretmenpro-db zaten çalışıyor veya bulunamadı" }

Write-Host "2. Backend kontrol ediliyor (port 4000)..." -ForegroundColor Cyan
$backendDir = Join-Path $PSScriptRoot ".." "backend"
if (Test-BackendUp) {
  Write-Host "   Backend zaten çalışıyor, yeni process başlatılmadı." -ForegroundColor Yellow
} else {
  Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendDir'; npm run start:dev" -WindowStyle Normal
  Write-Host "   Backend ayağa kalkana kadar bekleniyor..." -ForegroundColor Yellow
  $ok = $false
  for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Seconds 2
    if (Test-BackendUp) { $ok = $true; break }
  }
  if (-not $ok) {
    Write-Host "   Backend 40 sn içinde hazır olmadı. Backend terminalini kontrol edin." -ForegroundColor Red
    Write-Host "   Olası neden: EADDRINUSE, .env hatası, DB bağlantı sorunu." -ForegroundColor Red
    exit 1
  }
}

Write-Host "3. Web-admin başlatılıyor (port 3000)..." -ForegroundColor Cyan
$webDir = Join-Path $PSScriptRoot ".." "web-admin"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$webDir'; npm run dev" -WindowStyle Normal

Write-Host ""
Write-Host "Tamamlandı." -ForegroundColor Green
Write-Host "  Backend:  http://localhost:4000" 
Write-Host "  Web-admin: http://localhost:3000"
Write-Host ""
Write-Host "Not: Mevcut backend/web-admin çalışıyorsa EADDRINUSE veya lock hatası alabilirsiniz." -ForegroundColor Yellow

