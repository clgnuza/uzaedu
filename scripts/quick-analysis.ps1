# Quick Web Analysis - Nobet Yonetimi
# This script collects basic information without Selenium

param(
    [string]$Url = "https://www.nobetyonetim.net/Account/Login"
)

Write-Host "=== Nobet Yonetimi Quick Analysis ===" -ForegroundColor Cyan
Write-Host ""

# 1. Main page analysis
Write-Host "1. Main page analysis..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing
    Write-Host "   Status code: $($response.StatusCode)" -ForegroundColor Green
    
    $titleMatch = $response.Content | Select-String -Pattern '<title>(.*?)</title>'
    if ($titleMatch) {
        Write-Host "   Title: $($titleMatch.Matches.Groups[1].Value)" -ForegroundColor Green
    }
    
    # Find forms
    $forms = $response.Content | Select-String -Pattern '<form.*?>' -AllMatches
    Write-Host "   Form count: $($forms.Matches.Count)" -ForegroundColor Green
    
    # Find input fields
    $inputs = $response.Content | Select-String -Pattern '<input.*?name="(.*?)"' -AllMatches
    Write-Host "   Input fields:" -ForegroundColor Green
    foreach ($match in $inputs.Matches) {
        $name = $match.Groups[1].Value
        Write-Host "     - $name" -ForegroundColor Gray
    }
    
    # Find links
    $links = $response.Content | Select-String -Pattern '<a.*?href="(.*?)"' -AllMatches
    Write-Host "   Link count: $($links.Matches.Count)" -ForegroundColor Green
    
} catch {
    Write-Host "   Error: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "2. Checking robots.txt..." -ForegroundColor Yellow
try {
    $robotsUrl = "https://www.nobetyonetim.net/robots.txt"
    $robots = Invoke-WebRequest -Uri $robotsUrl -UseBasicParsing
    Write-Host "   robots.txt found:" -ForegroundColor Green
    Write-Host $robots.Content -ForegroundColor Gray
} catch {
    Write-Host "   robots.txt not found" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "3. Checking sitemap..." -ForegroundColor Yellow
try {
    $sitemapUrl = "https://www.nobetyonetim.net/sitemap.xml"
    $sitemap = Invoke-WebRequest -Uri $sitemapUrl -UseBasicParsing
    Write-Host "   Sitemap found" -ForegroundColor Green
    
    # Extract URLs
    $urls = $sitemap.Content | Select-String -Pattern '<loc>(.*?)</loc>' -AllMatches
    Write-Host "   Total URLs: $($urls.Matches.Count)" -ForegroundColor Green
    
    foreach ($match in $urls.Matches | Select-Object -First 20) {
        $url = $match.Groups[1].Value
        Write-Host "     - $url" -ForegroundColor Gray
    }
    
} catch {
    Write-Host "   Sitemap not found" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "4. General information..." -ForegroundColor Yellow

# Headers
try {
    $response = Invoke-WebRequest -Uri $Url -Method Head -UseBasicParsing
    Write-Host "   Server: $($response.Headers['Server'])" -ForegroundColor Green
    Write-Host "   Content-Type: $($response.Headers['Content-Type'])" -ForegroundColor Green
    Write-Host "   X-Powered-By: $($response.Headers['X-Powered-By'])" -ForegroundColor Green
} catch {
    Write-Host "   Could not get header information" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Analysis completed ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "For detailed exploration:" -ForegroundColor Yellow
Write-Host "  1. Use nobetyonetim-exploration-guide.md (manual)" -ForegroundColor White
Write-Host "  2. Run explore-nobetyonetim.py script (automatic)" -ForegroundColor White
