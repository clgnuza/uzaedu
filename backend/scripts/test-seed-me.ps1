# Seed + /me testi. Backend ve PostgreSQL calisir olmali.
# Kullanim: .\scripts\test-seed-me.ps1
$base = "http://localhost:4000/api"
Write-Host "1. POST $base/seed ..."
try {
    $seed = Invoke-RestMethod -Uri "$base/seed" -Method Post
} catch {
    Write-Host "Hata: $_" -ForegroundColor Red
    exit 1
}
$userId = $seed.userId
Write-Host "   userId: $userId"
Write-Host "2. GET $base/me (Bearer $userId) ..."
try {
    $me = Invoke-RestMethod -Uri "$base/me" -Method Get -Headers @{ Authorization = "Bearer $userId" }
    Write-Host "   role: $($me.role), email: $($me.email)" -ForegroundColor Green
    Write-Host "Test OK."
} catch {
    Write-Host "Hata: $_" -ForegroundColor Red
    exit 1
}
