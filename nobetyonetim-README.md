# Nöbet Yönetimi Sistemi İnceleme Araçları

Bu klasörde Nöbet Yönetimi sistemini (https://www.nobetyonetim.net) incelemek için hazırlanmış araçlar bulunmaktadır.

## Dosyalar

1. **nobetyonetim-exploration-guide.md** - Detaylı manuel inceleme kılavuzu
2. **scripts/explore-nobetyonetim.ps1** - PowerShell otomatik inceleme script'i
3. **scripts/explore-nobetyonetim.py** - Python otomatik inceleme script'i

---

## Yöntem 1: Manuel İnceleme (Önerilen)

En detaylı sonuçlar için manuel inceleme yapmanız önerilir.

### Adımlar:

1. `nobetyonetim-exploration-guide.md` dosyasını açın
2. Tarayıcınızda https://www.nobetyonetim.net/Account/Login adresine gidin
3. Login bilgileri:
   - Kurum Kodu: `123456`
   - Şifre: `123456`
4. Kılavuzdaki her bölümü sırayla inceleyin
5. Her sayfa için ekran görüntüsü alın (Windows: Win+Shift+S)
6. Notlarınızı kılavuzdaki "Notlar ve Gözlemler" bölümüne yazın
7. "Karşılaştırma Tablosu" ve "Rapor Şablonu" bölümlerini doldurun

### Avantajları:
- En detaylı inceleme
- Kullanıcı deneyimini gerçekten hissedebilme
- Küçük detayları fark edebilme
- Sistem mantığını anlayabilme

---

## Yöntem 2: PowerShell Script (Otomatik)

Windows PowerShell kullanarak otomatik inceleme.

### Gereksinimler:

```powershell
# Selenium modülünü yükle
Install-Module -Name Selenium -Scope CurrentUser
```

### Kullanım:

```powershell
# Script'i çalıştır
.\scripts\explore-nobetyonetim.ps1

# Özel klasör belirtmek için
.\scripts\explore-nobetyonetim.ps1 -OutputDir ".\screenshots" -ReportFile ".\report.md"
```

### Çıktılar:
- `nobetyonetim-screenshots/` - Tüm ekran görüntüleri
- `nobetyonetim-report.md` - Otomatik oluşturulan rapor

---

## Yöntem 3: Python Script (Otomatik)

Python ve Selenium kullanarak otomatik inceleme.

### Gereksinimler:

```bash
# Selenium'u yükle
pip install selenium

# ChromeDriver'ı indir ve PATH'e ekle
# https://chromedriver.chromium.org/downloads
```

### Kullanım:

```bash
# Script'i çalıştır
python scripts/explore-nobetyonetim.py

# Headless modda çalıştır (tarayıcı açmadan)
python scripts/explore-nobetyonetim.py --headless

# Özel klasör belirtmek için
python scripts/explore-nobetyonetim.py --output-dir screenshots
```

### Çıktılar:
- `nobetyonetim-screenshots/` - Tüm ekran görüntüleri
- `nobetyonetim-report.md` - Otomatik oluşturulan rapor

---

## İnceleme Sonrası

Otomatik script'ler temel bilgileri toplar, ancak **manuel inceleme şarttır**. Script'lerin ürettiği raporu temel alıp, manuel inceleme ile detaylandırın.

### Yapılacaklar:

1. ✅ Script'i çalıştır (veya manuel incele)
2. ✅ Screenshot'ları incele
3. ✅ Otomatik raporu oku
4. ✅ Manuel olarak her bölümü detaylı incele
5. ✅ Karşılaştırma tablosunu doldur
6. ✅ Öğretmen Pro için özellik listesi çıkar
7. ✅ Teknik ekiple paylaş

---

## İnceleme Odak Noktaları

### 1. Nöbet Planı Oluşturma
- ❓ Ders saati bazında nöbet ataması var mı?
- ❓ Otomatik plan oluşturma algoritması nasıl çalışıyor?
- ❓ Hangi kısıtlamalar var?
- ❓ Öğretmen müsaitlik kontrolü nasıl yapılıyor?

### 2. Vekalet Sistemi
- ❓ Vekalet önerisi algoritması nasıl çalışıyor?
- ❓ Boş ders saati filtresi var mı?
- ❓ Branş bazında önceliklendirme var mı?
- ❓ Ağırlıklı sayım var mı?

### 3. İstatistikler
- ❓ Hangi adalet metrikleri kullanılıyor?
- ❓ Nöbet yükü nasıl hesaplanıyor?
- ❓ Vekalet sayımı nasıl yapılıyor?
- ❓ Raporlama özellikleri neler?

### 4. Ders Programı
- ❓ Ders programı nasıl girilir?
- ❓ Excel import var mı?
- ❓ Boş ders saatleri nasıl tespit ediliyor?
- ❓ Çakışma kontrolü var mı?

### 5. Kullanıcı Deneyimi
- ❓ Arayüz ne kadar kullanıcı dostu?
- ❓ Mobil uyumlu mu?
- ❓ Performans nasıl?
- ❓ Hata mesajları yeterince açıklayıcı mı?

---

## Karşılaştırma: Öğretmen Pro vs Nöbet Yönetimi

İnceleme sonrası bu tabloyu doldurun:

| Özellik | Nöbet Yönetimi | Öğretmen Pro | Kazanan |
|---------|----------------|--------------|---------|
| Nöbet Planı Oluşturma | ? | Planlı | ? |
| Ders Saati Bazında Nöbet | ? | Planlı | ? |
| Otomatik Nöbet Dağılımı | ? | Planlı | ? |
| Vekalet Önerisi | ? | Planlı | ? |
| Boş Ders Saati Filtresi | ? | Planlı | ? |
| Ağırlıklı Vekalet Sayımı | ? | Planlı | ? |
| Adalet İstatistikleri | ? | Planlı | ? |
| Ders Programı Yönetimi | ? | Planlı | ? |
| Bildirim Sistemi | ? | Var | ? |
| Mobil Uygulama | ? | Planlı | ? |
| Excel Import/Export | ? | Planlı | ? |
| UI/UX Kalitesi | ? | Modern | ? |
| Performans | ? | Optimize | ? |

---

## Sonraki Adımlar

1. İnceleme tamamlandıktan sonra bulgularınızı ekiple paylaşın
2. Öğretmen Pro'ya eklenecek özellikleri belirleyin
3. Eksik kalan özellikleri önceliklendirin
4. Geliştirme planını güncelleyin

---

## Notlar

- Demo hesap herkes tarafından kullanılabilir, gerçek veri içermez
- Sistemde değişiklik yapmak güvenlidir (demo ortamı)
- Tüm ekran görüntülerini kaydedin, sonra karşılaştırma yaparken işe yarar
- Özellikle "Öğretmen Gelmedi" bölümünü detaylı inceleyin (vekalet sistemi)

---

**Hazırlayan:** AI Assistant  
**Tarih:** 19 Şubat 2026  
**Versiyon:** 1.0
