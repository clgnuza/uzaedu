# Optik form PDF indirme testi. Backend ve PostgreSQL calisir olmali.
# Kullanim: .\scripts\test-optik-pdf.ps1
$base = "http://localhost:4000/api"

Write-Host "1. POST $base/auth/login (teacher@demo.local) ..."
$body = @{ email = "teacher@demo.local"; password = "Tr9m!kL2$vNx8Qw@bR4hJ" } | ConvertTo-Json
try {
    $login = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -Body $body -ContentType "application/json"
} catch {
    Write-Host "Login hatasi: $_" -ForegroundColor Red
    exit 1
}
$token = $login.token
Write-Host "   Token alindi." -ForegroundColor Green

Write-Host "2. GET $base/optik/form-templates ..."
$headers = @{ Authorization = "Bearer $token" }
try {
    $templates = Invoke-RestMethod -Uri "$base/optik/form-templates" -Method Get -Headers $headers
} catch {
    Write-Host "Form templates hatasi: $_" -ForegroundColor Red
    exit 1
}

if ($templates.Count -eq 0) {
    Write-Host "   Hic form sablonu yok. Once seed-optik-form-templates calistirin." -ForegroundColor Yellow
    exit 1
}
$firstId = $templates[0].id
Write-Host "   $($templates.Count) sablon bulundu. Ilk: $firstId ($($templates[0].name))" -ForegroundColor Green

Write-Host "3. GET $base/optik/form-templates/$firstId/pdf ..."
try {
    $pdfRes = Invoke-WebRequest -Uri "$base/optik/form-templates/$firstId/pdf" -Method Get -Headers $headers -UseBasicParsing
} catch {
    Write-Host "PDF indirme hatasi: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $reader.BaseStream.Position = 0
        $errBody = $reader.ReadToEnd()
        Write-Host "   Yanit: $errBody" -ForegroundColor Red
    }
    exit 1
}

if ($pdfRes.StatusCode -ne 200) {
    Write-Host "   Beklenmeyen status: $($pdfRes.StatusCode)" -ForegroundColor Red
    exit 1
}

$pdfLen = $pdfRes.Content.Length
if ($pdfLen -lt 100) {
    Write-Host "   PDF cok kucuk ($pdfLen byte), hata olabilir." -ForegroundColor Yellow
} else {
    Write-Host "   PDF indirildi: $pdfLen byte" -ForegroundColor Green
}

# PDF magic bytes kontrolu
$bytes = [byte[]]$pdfRes.Content
$magic = [System.Text.Encoding]::ASCII.GetString($bytes[0..4])
if ($magic -eq "%PDF-") {
    Write-Host "   PDF format dogrulandi (%PDF-)" -ForegroundColor Green
} else {
    Write-Host "   UYARI: Gecerli PDF degil (ilk 5 byte: $magic)" -ForegroundColor Red
    exit 1
}

Write-Host "Test OK." -ForegroundColor Green
