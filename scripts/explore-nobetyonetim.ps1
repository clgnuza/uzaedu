# Nöbet Yönetimi Sistemi Otomatik İnceleme Script'i
# Bu script Selenium WebDriver kullanarak sistemi otomatik olarak inceler

param(
    [string]$OutputDir = ".\nobetyonetim-screenshots",
    [string]$ReportFile = ".\nobetyonetim-report.md"
)

# Gerekli modülleri kontrol et
function Test-SeleniumModule {
    if (-not (Get-Module -ListAvailable -Name Selenium)) {
        Write-Host "Selenium modülü bulunamadı. Yükleniyor..." -ForegroundColor Yellow
        Install-Module -Name Selenium -Force -Scope CurrentUser
    }
    Import-Module Selenium
}

# Screenshot klasörünü oluştur
function Initialize-OutputDirectory {
    if (-not (Test-Path $OutputDir)) {
        New-Item -ItemType Directory -Path $OutputDir | Out-Null
        Write-Host "Screenshot klasörü oluşturuldu: $OutputDir" -ForegroundColor Green
    }
}

# Chrome driver'ı başlat
function Start-ChromeDriver {
    try {
        $driver = Start-SeChrome -Headless
        Write-Host "Chrome driver başlatıldı" -ForegroundColor Green
        return $driver
    }
    catch {
        Write-Host "Chrome driver başlatılamadı: $_" -ForegroundColor Red
        Write-Host "Lütfen ChromeDriver'ı indirin: https://chromedriver.chromium.org/" -ForegroundColor Yellow
        exit 1
    }
}

# Screenshot al
function Take-Screenshot {
    param(
        [Parameter(Mandatory=$true)]
        $Driver,
        [Parameter(Mandatory=$true)]
        [string]$Name,
        [string]$Description = ""
    )
    
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $filename = "$Name`_$timestamp.png"
    $filepath = Join-Path $OutputDir $filename
    
    try {
        $Driver.GetScreenshot().SaveAsFile($filepath, [OpenQA.Selenium.ScreenshotImageFormat]::Png)
        Write-Host "Screenshot alındı: $filename" -ForegroundColor Green
        
        # Rapor için bilgi döndür
        return @{
            Name = $Name
            Filename = $filename
            Description = $Description
            Timestamp = $timestamp
        }
    }
    catch {
        Write-Host "Screenshot alınamadı: $_" -ForegroundColor Red
        return $null
    }
}

# Sayfanın yüklenmesini bekle
function Wait-PageLoad {
    param(
        [Parameter(Mandatory=$true)]
        $Driver,
        [int]$Seconds = 2
    )
    
    Start-Sleep -Seconds $Seconds
}

# Element'in görünmesini bekle
function Wait-Element {
    param(
        [Parameter(Mandatory=$true)]
        $Driver,
        [Parameter(Mandatory=$true)]
        [string]$Selector,
        [int]$TimeoutSeconds = 10
    )
    
    $wait = New-Object OpenQA.Selenium.Support.UI.WebDriverWait($Driver, [TimeSpan]::FromSeconds($TimeoutSeconds))
    try {
        $element = $wait.Until([OpenQA.Selenium.Support.UI.ExpectedConditions]::ElementIsVisible([OpenQA.Selenium.By]::CssSelector($Selector)))
        return $element
    }
    catch {
        Write-Host "Element bulunamadı: $Selector" -ForegroundColor Yellow
        return $null
    }
}

# Menü öğelerini topla
function Get-MenuItems {
    param(
        [Parameter(Mandatory=$true)]
        $Driver
    )
    
    $menuItems = @()
    
    try {
        # Ana menü öğelerini bul (CSS selector'ları siteye göre ayarlanmalı)
        $elements = $Driver.FindElements([OpenQA.Selenium.By]::CssSelector("nav a, .menu a, .sidebar a"))
        
        foreach ($element in $elements) {
            $text = $element.Text.Trim()
            $href = $element.GetAttribute("href")
            
            if ($text -and $href) {
                $menuItems += @{
                    Text = $text
                    Href = $href
                }
            }
        }
    }
    catch {
        Write-Host "Menü öğeleri alınamadı: $_" -ForegroundColor Yellow
    }
    
    return $menuItems
}

# Sayfa içeriğini analiz et
function Analyze-PageContent {
    param(
        [Parameter(Mandatory=$true)]
        $Driver,
        [Parameter(Mandatory=$true)]
        [string]$PageName
    )
    
    $analysis = @{
        PageName = $PageName
        Title = $Driver.Title
        URL = $Driver.Url
        Forms = @()
        Tables = @()
        Buttons = @()
        Inputs = @()
    }
    
    try {
        # Form'ları bul
        $forms = $Driver.FindElements([OpenQA.Selenium.By]::TagName("form"))
        foreach ($form in $forms) {
            $analysis.Forms += @{
                Action = $form.GetAttribute("action")
                Method = $form.GetAttribute("method")
            }
        }
        
        # Tabloları bul
        $tables = $Driver.FindElements([OpenQA.Selenium.By]::TagName("table"))
        $analysis.Tables += "Toplam tablo sayısı: $($tables.Count)"
        
        # Butonları bul
        $buttons = $Driver.FindElements([OpenQA.Selenium.By]::TagName("button"))
        foreach ($button in $buttons) {
            $text = $button.Text.Trim()
            if ($text) {
                $analysis.Buttons += $text
            }
        }
        
        # Input alanlarını bul
        $inputs = $Driver.FindElements([OpenQA.Selenium.By]::TagName("input"))
        foreach ($input in $inputs) {
            $type = $input.GetAttribute("type")
            $name = $input.GetAttribute("name")
            $placeholder = $input.GetAttribute("placeholder")
            
            if ($name -or $placeholder) {
                $analysis.Inputs += @{
                    Type = $type
                    Name = $name
                    Placeholder = $placeholder
                }
            }
        }
    }
    catch {
        Write-Host "Sayfa içeriği analiz edilemedi: $_" -ForegroundColor Yellow
    }
    
    return $analysis
}

# Rapor oluştur
function Generate-Report {
    param(
        [Parameter(Mandatory=$true)]
        [array]$Screenshots,
        [Parameter(Mandatory=$true)]
        [array]$PageAnalyses,
        [Parameter(Mandatory=$true)]
        [string]$OutputFile
    )
    
    $report = @"
# Nöbet Yönetimi Sistemi - Otomatik İnceleme Raporu

**Tarih:** $(Get-Date -Format "dd.MM.yyyy HH:mm")  
**URL:** https://www.nobetyonetim.net

---

## Özet

- **Toplam incelenen sayfa:** $($PageAnalyses.Count)
- **Toplam alınan screenshot:** $($Screenshots.Count)

---

## Sayfa Analizleri

"@

    foreach ($analysis in $PageAnalyses) {
        $report += @"

### $($analysis.PageName)

**URL:** $($analysis.URL)  
**Başlık:** $($analysis.Title)

#### Form'lar
$($analysis.Forms | ForEach-Object { "- Action: $($_.Action), Method: $($_.Method)" } | Out-String)

#### Butonlar
$($analysis.Buttons | ForEach-Object { "- $_" } | Out-String)

#### Input Alanları
$($analysis.Inputs | ForEach-Object { "- Type: $($_.Type), Name: $($_.Name), Placeholder: $($_.Placeholder)" } | Out-String)

---

"@
    }
    
    $report += @"

## Ekran Görüntüleri

"@

    foreach ($screenshot in $Screenshots) {
        $report += @"
### $($screenshot.Name)

![Screenshot](./$OutputDir/$($screenshot.Filename))

**Açıklama:** $($screenshot.Description)  
**Zaman:** $($screenshot.Timestamp)

---

"@
    }
    
    $report | Out-File -FilePath $OutputFile -Encoding UTF8
    Write-Host "Rapor oluşturuldu: $OutputFile" -ForegroundColor Green
}

# Ana fonksiyon
function Start-Exploration {
    Write-Host "=== Nöbet Yönetimi Sistemi Otomatik İnceleme ===" -ForegroundColor Cyan
    Write-Host ""
    
    # Hazırlık
    Test-SeleniumModule
    Initialize-OutputDirectory
    
    $screenshots = @()
    $pageAnalyses = @()
    
    # Chrome driver'ı başlat
    $driver = Start-ChromeDriver
    
    try {
        # 1. Login sayfasına git
        Write-Host "1. Login sayfasına gidiliyor..." -ForegroundColor Cyan
        $driver.Navigate().GoToUrl("https://www.nobetyonetim.net/Account/Login")
        Wait-PageLoad -Driver $driver -Seconds 3
        
        $screenshots += Take-Screenshot -Driver $driver -Name "01_login_page" -Description "Login sayfası"
        $pageAnalyses += Analyze-PageContent -Driver $driver -PageName "Login Sayfası"
        
        # 2. Login işlemi
        Write-Host "2. Login işlemi yapılıyor..." -ForegroundColor Cyan
        
        # Kurum Kodu
        $kurumKoduInput = $driver.FindElement([OpenQA.Selenium.By]::Name("KurumKodu"))
        $kurumKoduInput.SendKeys("123456")
        
        # Şifre
        $sifreInput = $driver.FindElement([OpenQA.Selenium.By]::Name("Sifre"))
        $sifreInput.SendKeys("123456")
        
        # Login butonuna tıkla
        $loginButton = $driver.FindElement([OpenQA.Selenium.By]::CssSelector("button[type='submit'], input[type='submit']"))
        $loginButton.Click()
        
        Wait-PageLoad -Driver $driver -Seconds 5
        
        # 3. Dashboard
        Write-Host "3. Dashboard inceleniyor..." -ForegroundColor Cyan
        $screenshots += Take-Screenshot -Driver $driver -Name "02_dashboard" -Description "Ana dashboard"
        $pageAnalyses += Analyze-PageContent -Driver $driver -PageName "Dashboard"
        
        # 4. Menü öğelerini topla
        Write-Host "4. Menü öğeleri toplanıyor..." -ForegroundColor Cyan
        $menuItems = Get-MenuItems -Driver $driver
        
        Write-Host "Bulunan menü öğeleri:" -ForegroundColor Yellow
        $menuItems | ForEach-Object { Write-Host "  - $($_.Text): $($_.Href)" }
        
        # 5. Her menü öğesini ziyaret et
        $counter = 3
        foreach ($menuItem in $menuItems) {
            $counter++
            Write-Host "$counter. $($menuItem.Text) sayfası inceleniyor..." -ForegroundColor Cyan
            
            try {
                $driver.Navigate().GoToUrl($menuItem.Href)
                Wait-PageLoad -Driver $driver -Seconds 3
                
                $safeName = $menuItem.Text -replace '[^a-zA-Z0-9]', '_'
                $screenshots += Take-Screenshot -Driver $driver -Name "$($counter.ToString('00'))_$safeName" -Description $menuItem.Text
                $pageAnalyses += Analyze-PageContent -Driver $driver -PageName $menuItem.Text
            }
            catch {
                Write-Host "Sayfa ziyaret edilemedi: $($menuItem.Text)" -ForegroundColor Red
            }
        }
        
        # 6. Rapor oluştur
        Write-Host "Rapor oluşturuluyor..." -ForegroundColor Cyan
        Generate-Report -Screenshots $screenshots -PageAnalyses $pageAnalyses -OutputFile $ReportFile
        
        Write-Host ""
        Write-Host "=== İnceleme tamamlandı ===" -ForegroundColor Green
        Write-Host "Screenshot'lar: $OutputDir" -ForegroundColor Green
        Write-Host "Rapor: $ReportFile" -ForegroundColor Green
    }
    catch {
        Write-Host "Hata oluştu: $_" -ForegroundColor Red
        Write-Host $_.ScriptStackTrace -ForegroundColor Red
    }
    finally {
        # Driver'ı kapat
        if ($driver) {
            $driver.Quit()
            Write-Host "Browser kapatıldı" -ForegroundColor Yellow
        }
    }
}

# Script'i çalıştır
Start-Exploration
