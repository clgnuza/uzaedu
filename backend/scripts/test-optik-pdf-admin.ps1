# Superadmin optik PDF testi. Backend ve DB calisir olmali.
$base = "http://localhost:4000/api"

Write-Host "1. POST $base/auth/login (superadmin@demo.local) ..."
$body = @{ email = "superadmin@demo.local"; password = "Su1n^qV4%pX9dK8*hL0j" } | ConvertTo-Json
try {
    $login = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -Body $body -ContentType "application/json"
} catch {
    Write-Host "Login hatasi: $_" -ForegroundColor Red
    exit 1
}
$token = $login.token
Write-Host "   Token alindi." -ForegroundColor Green

Write-Host "2. GET $base/optik/admin/form-templates ..."
$headers = @{ Authorization = "Bearer $token" }
try {
    $templates = Invoke-RestMethod -Uri "$base/optik/admin/form-templates" -Method Get -Headers $headers
} catch {
    Write-Host "Form templates hatasi: $_" -ForegroundColor Red
    exit 1
}

if ($templates.Count -eq 0) {
    Write-Host "   Hic form sablonu yok." -ForegroundColor Yellow
    exit 1
}
$firstId = $templates[0].id
Write-Host "   Ilk sablon: $firstId" -ForegroundColor Green

Write-Host "3. GET $base/optik/admin/form-templates/$firstId/pdf?prepend_blank=1 ..."
try {
    $pdfRes = Invoke-WebRequest -Uri "$base/optik/admin/form-templates/$firstId/pdf?prepend_blank=1" -Method Get -Headers $headers -UseBasicParsing
} catch {
    Write-Host "PDF hatasi: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $reader.BaseStream.Position = 0
        Write-Host "   Status: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
        Write-Host "   Body: $($reader.ReadToEnd())" -ForegroundColor Red
    }
    exit 1
}

if ($pdfRes.StatusCode -ne 200) {
    Write-Host "   Beklenmeyen status: $($pdfRes.StatusCode)" -ForegroundColor Red
    exit 1
}
Write-Host "   PDF indirildi: $($pdfRes.Content.Length) byte" -ForegroundColor Green
$magic = [System.Text.Encoding]::ASCII.GetString([byte[]]$pdfRes.Content[0..4])
if ($magic -eq "%PDF-") { Write-Host "   PDF format OK" -ForegroundColor Green } else { Write-Host "   UYARI: Gecerli PDF degil" -ForegroundColor Red; exit 1 }
Write-Host "Test OK." -ForegroundColor Green
