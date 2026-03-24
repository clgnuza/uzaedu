# Nöbet Yönetimi İnceleme - Hızlı Referans

## 🚀 Hızlı Başlangıç

### Giriş Bilgileri
```
URL: https://www.nobetyonetim.net/Account/Login
Kurum Kodu: 123456
Şifre: 123456
Okul Tipi: ORTAOKUL
```

### İnceleme Yöntemleri

#### 1️⃣ Manuel İnceleme (ÖNERİLEN)
```bash
# Kılavuzu aç
nobetyonetim-exploration-guide.md

# Tarayıcıda sisteme giriş yap
# Her bölümü sırayla incele
# Ekran görüntüsü al (Win+Shift+S)
# Notlarını al
```

#### 2️⃣ Python Otomatik
```bash
pip install selenium
python scripts/explore-nobetyonetim.py
# veya headless:
python scripts/explore-nobetyonetim.py --headless
```

#### 3️⃣ PowerShell Otomatik
```powershell
Install-Module -Name Selenium -Scope CurrentUser
.\scripts\explore-nobetyonetim.ps1
```

#### 4️⃣ Hızlı Analiz
```powershell
.\scripts\quick-analysis.ps1
```

---

## 📋 İnceleme Kontrol Listesi

### Kritik Özellikler (Öncelik 1)

#### ✅ Nöbet Planı
- [ ] Ders saati bazında nöbet ataması?
- [ ] Otomatik plan oluşturma algoritması?
- [ ] Adalet metrikleri?
- [ ] Öğretmen müsaitlik kontrolü?
- [ ] Manuel düzenleme?

#### ✅ Vekalet Sistemi
- [ ] Vekalet önerisi algoritması?
- [ ] Boş ders saati filtresi?
- [ ] Branş önceliklendirme?
- [ ] Ağırlıklı sayım?
- [ ] Bildirim sistemi?

#### ✅ İstatistikler
- [ ] Adalet metrikleri?
- [ ] Nöbet yükü hesaplama?
- [ ] Vekalet istatistikleri?
- [ ] Grafik raporlar?
- [ ] Export (Excel/PDF)?

#### ✅ Ders Programı
- [ ] Ders programı girişi?
- [ ] Excel import?
- [ ] Boş ders tespiti?
- [ ] Çakışma kontrolü?
- [ ] Haftalık görünüm?

### Destek Özellikleri (Öncelik 2)

#### ✅ Nöbet Yerleri
- [ ] Nöbet yeri tanımlama?
- [ ] Gerekli öğretmen sayısı?
- [ ] Nöbet yeri tipleri?

#### ✅ Öğretmen Yönetimi
- [ ] Öğretmen listesi?
- [ ] Branş yönetimi?
- [ ] Özel durumlar?

#### ✅ Ayarlar
- [ ] Genel ayarlar?
- [ ] Nöbet ayarları?
- [ ] Bildirim ayarları?

---

## 🎯 Kritik Sorular

### Algoritma
1. Otomatik nöbet dağılımı nasıl çalışıyor?
2. Vekalet önerisi algoritması nasıl?
3. Ağırlıklı sayım nasıl hesaplanıyor?

### Entegrasyon
4. Ders programı entegrasyonu nasıl?
5. Boş ders saatleri otomatik tespit ediliyor mu?

### UX/UI
6. Kullanıcı deneyimi nasıl?
7. Mobil uyumlu mu?

### Teknik
8. Performans nasıl?
9. Raporlama özellikleri neler?
10. Bildirim sistemi nasıl çalışıyor?

---

## 📸 Alınacak Screenshot'lar

### Zorunlu
1. ✅ Login sayfası
2. ⏳ Dashboard
3. ⏳ Nöbet planı - Liste
4. ⏳ Nöbet planı - Oluşturma
5. ⏳ Öğretmen gelmedi - Ana ekran
6. ⏳ Öğretmen gelmedi - Vekalet önerisi
7. ⏳ İstatistikler - Dashboard
8. ⏳ Ders programı - Giriş
9. ⏳ Ders programı - Görüntüleme

### İsteğe Bağlı
10. ⏳ Nöbet yerleri
11. ⏳ Öğretmen listesi
12. ⏳ Ayarlar
13. ⏳ Raporlar
14. ⏳ Bildirimler

---

## 📊 Karşılaştırma Matrisi

| Özellik | Nöbet Yön. | Öğretmen Pro |
|---------|------------|--------------|
| Ders saati bazında nöbet | ❓ | ✅ |
| Otomatik dağılım | ❓ | ✅ |
| Vekalet önerisi | ❓ | ✅ |
| Boş ders filtresi | ❓ | ✅ |
| Ağırlıklı sayım | ❓ | ✅ |
| Adalet metrikleri | ❓ | ✅ |
| Ders programı | ❓ | ✅ |
| Bildirim | ❓ | ✅ |
| Mobil app | ❓ | ✅ |
| Modern UI | ❓ | ✅ |

---

## 📁 Dosyalar

```
📄 nobetyonetim-exploration-guide.md  # Detaylı kılavuz
📄 nobetyonetim-README.md             # Kullanım kılavuzu
📄 NOBETYONETIM_EXPLORATION_SUMMARY.md # Özet rapor
📄 QUICK_REFERENCE.md                 # Bu dosya

📂 scripts/
  🐍 explore-nobetyonetim.py          # Python script
  💻 explore-nobetyonetim.ps1         # PowerShell script
  ⚡ quick-analysis.ps1               # Hızlı analiz
```

---

## 🔍 Hızlı Analiz Sonuçları

```
✅ Status: 200 OK
✅ Server: Microsoft-IIS/10.0
✅ Tech: ASP.NET
✅ Form: 1 (Login)
✅ Inputs: OkulKod, Password
✅ Links: 14
```

---

## ⏭️ Sonraki Adımlar

1. ⏳ Manuel inceleme yap (2-3 saat)
2. ⏳ Screenshot'ları topla
3. ⏳ Notları düzenle
4. ⏳ Raporu tamamla
5. ⏳ Ekiple paylaş
6. ⏳ Özellik listesi çıkar
7. ⏳ Sprint planı güncelle

---

## 💡 İpuçları

### Manuel İnceleme
- ✅ Sistematik ol, kılavuzu takip et
- ✅ Çok screenshot al
- ✅ Detaylı notlar tut
- ✅ Kullanıcı gözüyle bak
- ✅ Algoritmaları anlamaya çalış

### Otomatik Script
- ✅ Manuel incelemeyi önce tamamla
- ✅ Screenshot'ları kontrol et
- ✅ Raporu manuel tamamla
- ✅ Farklı sayfaları dene

### Karşılaştırma
- ✅ Objektif ol
- ✅ Kullanıcı ihtiyacına odaklan
- ✅ Teknik fizibiliteyi düşün
- ✅ Önceliklendirme yap

---

## 🆘 Sorun Giderme

### Script Çalışmıyor
```bash
# Python
pip install --upgrade selenium
# ChromeDriver indir: https://chromedriver.chromium.org/

# PowerShell
Install-Module -Name Selenium -Force
```

### Login Başarısız
```
Kurum Kodu: 123456 (sıfır yok)
Şifre: 123456
Okul Tipi: ORTAOKUL seçili mi?
```

### Screenshot Alınamıyor
```
Windows: Win + Shift + S
Manuel screenshot al
```

---

## 📞 İletişim

**Proje:** Öğretmen Pro  
**Görev:** Nöbet Yönetimi Sistemi İnceleme  
**Tarih:** 19 Şubat 2026  
**Durum:** Araçlar hazır, manuel inceleme bekleniyor

---

**Hızlı Başlat:**
```bash
# 1. Kılavuzu aç
code nobetyonetim-exploration-guide.md

# 2. Tarayıcıda aç
start https://www.nobetyonetim.net/Account/Login

# 3. Giriş yap: 123456 / 123456

# 4. İncele!
```
