# Nöbet Yönetimi Sistemi - Detaylı İnceleme Bulguları

**Tarih:** 19 Şubat 2026  
**İnceleme Yöntemi:** Otomatik (Selenium WebDriver) + Manuel Analiz  
**Demo Hesap:** Kurum Kodu: 123456, Şifre: 123456 (ORTAOKUL)

---

## Executive Summary

Nöbet Yönetimi (nobetyonetim.net) Türk okulları için nöbetçi öğretmen görevlendirme ve devamsızlık takibi yapan bir web uygulamasıdır. Demo hesabı sınırlı erişim sağlamaktadır (sadece görüntüleme), ancak sistemin temel yapısı ve özellikleri hakkında önemli bilgiler elde edilmiştir.

---

## 1. Teknik Altyapı

### Backend
- **Platform:** ASP.NET MVC
- **Web Server:** Microsoft IIS/10.0
- **Database:** SQL Server (muhtemelen)
- **Authentication:** Form-based authentication + CSRF token (__RequestVerificationToken)

### Frontend
- **Framework:** ASP.NET Razor Pages (server-side rendering)
- **UI Library:** Bootstrap (muhtemelen)
- **JavaScript:** jQuery (muhtemelen)

### Deployment
- **Hosting:** Bulut tabanlı (Microsoft Azure muhtemelen)
- **SSL:** HTTPS destekli
- **Subdomains:** 
  - ilkokul.nobetyonetim.net (İlkokul)
  - www.nobetyonetim.net (Ortaokul)
  - lise.nobetyonetim.net (Lise)
  - dijitalpano.nobetyonetim.net (Dijital Pano)

---

## 2. Kullanıcı Rolleri ve Erişim

### Demo Hesap (Kurum Kodu ile Giriş)
**Rol:** Öğretmen / Sınırlı Kullanıcı

**Erişebildiği Sayfalar:**
1. **Nöbetçiler** (/Home/Liste) - Günlük nöbetçi listesi
2. **Gelmeyen Ekle** (/Gelmeyen) - Gelmeyecek öğretmen bildirimi
3. **Görev Verilenler** (/Gorevlendirilen) - Görevlendirilen öğretmenler

**Erişemediği Özellikler:**
- Nöbet planı oluşturma
- Öğretmen yönetimi
- Ayarlar
- İstatistikler ve raporlar
- Yönetici paneli

### Telefon Numarası ile Giriş (Belirtilmiş)
**Rol:** Okul Yöneticisi / Admin

**Muhtemel Ek Yetkiler:**
- Nöbet planı oluşturma ve düzenleme
- Öğretmen ekleme/çıkarma
- Nöbet yerleri tanımlama
- İstatistik ve rapor görüntüleme
- Sistem ayarları

---

## 3. Keşfedilen Özellikler

### 3.1. Nöbetçiler (Dashboard)

**URL:** /Home/Liste

**Özellikler:**
- ✅ Günlük nöbetçi listesi görüntüleme
- ✅ Tarih bazlı gezinme (Önceki Gün / Sonraki Gün)
- ✅ Bugünün tarihi vurgulanmış ("19 Şubat - Perşembe Günü Nöbetçileri")
- ❓ Nöbetçi öğretmen isimleri (demo hesapta görünmüyor olabilir)
- ❓ Nöbet yerleri (Ana Kapı, Bahçe, vb.)
- ❓ Nöbet saatleri (Sabah, Teneffüs, Öğle, vb.)

**UI/UX Gözlemleri:**
- Basit, temiz arayüz
- Tarih navigasyonu kolay
- Mobil uyumlu olabilir (responsive design)

**Eksikler (Görünmeyen):**
- Nöbet planı oluşturma butonu yok (demo hesap sınırlı)
- Filtreleme seçenekleri yok
- Arama fonksiyonu yok

### 3.2. Gelmeyen Ekle (Absent Teacher)

**URL:** /Gelmeyen

**Özellikler:**
- ✅ Gelmeyecek öğretmen bildirimi
- ✅ Tarih bazlı görüntüleme
- ✅ "19 Şubat - Perşembe Günü Gelmeyecek Öğretmenler" başlığı
- ❓ Öğretmen seçimi (dropdown/liste)
- ❓ Gelmeyen nedeni (izin, hastalık, vb.)
- ❓ Ders saati bilgisi
- ❓ Otomatik vekalet önerisi

**Beklenen Akış (Tahmin):**
1. Tarih seç
2. Gelmeyecek öğretmeni seç
3. Neden belirt (opsiyonel)
4. Kaydet
5. Sistem otomatik vekalet önerisi sunar (?)

**Kritik Soru:**
- ❓ Vekalet önerisi algoritması var mı?
- ❓ Boş ders saati filtresi var mı?
- ❓ Branş bazında önceliklendirme var mı?

### 3.3. Görev Verilenler (Assigned Duties)

**URL:** /Gorevlendirilen

**Özellikler:**
- ✅ Görevlendirilen öğretmenler listesi
- ✅ Tarih bazlı görüntüleme
- ✅ "19 Şubat - Perşembe Günü Görevlendirilenler" başlığı
- ❓ Vekalet görevleri
- ❓ Ek nöbet görevleri
- ❓ Görevlendirme nedeni
- ❓ Görev süresi

**Muhtemel Kullanım:**
- Vekalet görevlerini görüntüleme
- Ek nöbet görevlerini görüntüleme
- Görevlendirme geçmişi

---

## 4. Eksik/Görünmeyen Özellikler

Demo hesap sınırlı olduğu için aşağıdaki özellikler görüntülenemedi:

### 4.1. Nöbet Planı Oluşturma
- ❌ Otomatik nöbet dağılımı
- ❌ Manuel nöbet ataması
- ❌ Ders saati bazında nöbet
- ❌ Nöbet yerleri tanımlama
- ❌ Haftalık/aylık plan görünümü

### 4.2. Öğretmen Yönetimi
- ❌ Öğretmen listesi
- ❌ Öğretmen ekleme/düzenleme
- ❌ Branş tanımlama
- ❌ Ders programı girişi
- ❌ Özel durumlar (muafiyet, vb.)

### 4.3. İstatistikler ve Raporlar
- ❌ Nöbet yükü istatistikleri
- ❌ Vekalet istatistikleri
- ❌ Adalet metrikleri
- ❌ Grafik raporlar
- ❌ Excel export

### 4.4. Ayarlar
- ❌ Okul bilgileri
- ❌ Eğitim-öğretim yılı ayarları
- ❌ Nöbet ayarları
- ❌ Bildirim ayarları
- ❌ Kullanıcı yönetimi

---

## 5. Karşılaştırma: Öğretmen Pro vs Nöbet Yönetimi

| Özellik | Nöbet Yönetimi | Öğretmen Pro | Kazanan | Notlar |
|---------|----------------|--------------|---------|--------|
| **Genel** |
| Teknoloji | ASP.NET / IIS | NestJS / PostgreSQL | ⚖️ | Farklı yaklaşımlar |
| UI/UX | Basit, eski | Modern, Mosaic | ✅ ÖP | Öğretmen Pro daha modern |
| Mobil App | ❓ | ✅ Planlı (Flutter) | ✅ ÖP | |
| API | ❓ | ✅ RESTful | ✅ ÖP | |
| **Nöbet Yönetimi** |
| Günlük nöbet listesi | ✅ | ✅ Planlı | ⚖️ | |
| Tarih navigasyonu | ✅ | ✅ Planlı | ⚖️ | |
| Nöbet planı oluşturma | ✅ (Yönetici) | ✅ Planlı | ❓ | Algoritma karşılaştırması gerekli |
| Ders saati bazında nöbet | ❓ | ✅ Planlı | ❓ | Kritik özellik |
| Otomatik dağılım | ❓ | ✅ Planlı | ❓ | |
| **Vekalet Sistemi** |
| Gelmeyen bildirimi | ✅ | ✅ Planlı | ⚖️ | |
| Görevlendirme listesi | ✅ | ✅ Planlı | ⚖️ | |
| Vekalet önerisi | ❓ | ✅ Planlı | ❓ | Kritik özellik |
| Boş ders filtresi | ❓ | ✅ Planlı | ❓ | Kritik özellik |
| Branş önceliklendirme | ❓ | ✅ Planlı | ❓ | |
| Ağırlıklı sayım | ❓ | ✅ Planlı | ❓ | |
| **İstatistikler** |
| Nöbet istatistikleri | ❓ | ✅ Planlı | ❓ | |
| Vekalet istatistikleri | ❓ | ✅ Planlı | ❓ | |
| Adalet metrikleri | ❓ | ✅ Planlı | ❓ | |
| Grafik raporlar | ❓ | ✅ Planlı | ❓ | |
| Excel export | ❓ | ✅ Planlı | ❓ | |
| **Ders Programı** |
| Ders programı yönetimi | ❓ | ✅ Planlı | ❓ | |
| Excel import | ❓ | ✅ Planlı | ❓ | |
| Boş ders tespiti | ❓ | ✅ Planlı | ❓ | |
| Çakışma kontrolü | ❓ | ✅ Planlı | ❓ | |
| **Bildirim** |
| Bildirim sistemi | ❓ | ✅ Var (Event) | ✅ ÖP | |
| SMS | ❓ | ❓ | ⚖️ | |
| Email | ❓ | ❓ | ⚖️ | |
| Push notification | ❓ | ✅ Planlı | ✅ ÖP | |

**Sonuç:** Demo hesap sınırlı olduğu için tam karşılaştırma yapılamadı. Yönetici hesabı ile tekrar inceleme gerekli.

---

## 6. Öne Çıkan Gözlemler

### Güçlü Yönler
1. ✅ **Basit ve anlaşılır arayüz** - Kullanıcı dostu
2. ✅ **Tarih bazlı navigasyon** - Kolay gezinme
3. ✅ **Okul tipi bazında ayrım** - İlkokul, Ortaokul, Lise
4. ✅ **Dijital pano entegrasyonu** - Ek özellik
5. ✅ **Çoklu okul desteği** - Kurum kodu sistemi

### Zayıf Yönler / Eksikler
1. ❌ **Eski UI/UX** - Modern tasarım değil
2. ❌ **Demo hesap çok sınırlı** - Özellikleri görmek zor
3. ❌ **Mobil uygulama yok** (muhtemelen)
4. ❌ **API dokümantasyonu yok**
5. ❌ **Yardım/Dokümantasyon eksik**

### Belirsiz Özellikler (Yönetici Hesabı Gerekli)
1. ❓ Otomatik nöbet dağılım algoritması
2. ❓ Vekalet önerisi sistemi
3. ❓ Boş ders saati filtresi
4. ❓ Adalet metrikleri
5. ❓ Ağırlıklı vekalet sayımı
6. ❓ Ders programı entegrasyonu
7. ❓ İstatistik ve raporlama
8. ❓ Bildirim sistemi

---

## 7. Kritik Sorular (Cevaplanamadı)

Demo hesap sınırlı olduğu için aşağıdaki kritik sorular cevaplanamadı:

### Algoritma ve Mantık
1. ❓ **Otomatik nöbet dağılımı nasıl çalışıyor?**
   - Hangi kriterlere göre dağıtım yapılıyor?
   - Adalet nasıl sağlanıyor?
   - Kısıtlamalar neler?

2. ❓ **Vekalet önerisi algoritması var mı?**
   - Boş ders saati kontrolü yapılıyor mu?
   - Branş önceliği var mı?
   - Nöbet yükü dengeleniyor mu?

3. ❓ **Ağırlıklı sayım nasıl hesaplanıyor?**
   - Kendi branşı vs farklı branş
   - Nöbet vs vekalet
   - Katsayılar neler?

### Entegrasyon ve Veri
4. ❓ **Ders programı nasıl girilir?**
   - Manuel giriş mi?
   - Excel import var mı?
   - Otomatik çakışma kontrolü var mı?

5. ❓ **Boş ders saatleri nasıl tespit ediliyor?**
   - Ders programı ile entegrasyon var mı?
   - Gerçek zamanlı kontrol var mı?

### Raporlama ve İstatistik
6. ❓ **Hangi adalet metrikleri kullanılıyor?**
   - Standart sapma?
   - Min/max farkı?
   - Hedef nöbet sayısı?

7. ❓ **Raporlama özellikleri neler?**
   - Excel export?
   - PDF export?
   - Grafik raporlar?

### Bildirim ve İletişim
8. ❓ **Bildirim sistemi nasıl çalışıyor?**
   - SMS gönderimi var mı?
   - Email bildirimi var mı?
   - Hangi durumlarda bildirim gönderiliyor?

---

## 8. Öğretmen Pro İçin Öneriler

### Öncelik 1: Kritik Özellikler (Mutlaka Olmalı)
1. ✅ **Ders saati bazında nöbet ataması** - Planlı
2. ✅ **Boş ders saati filtresi** - Planlı
3. ✅ **Vekalet önerisi algoritması** - Planlı
4. ✅ **Adalet metrikleri** - Planlı
5. ✅ **Ağırlıklı vekalet sayımı** - Planlı

### Öncelik 2: Rekabet Avantajı (Fark Yaratacak)
1. ✅ **Modern UI/UX** - Mosaic referans
2. ✅ **Mobil uygulama** - Flutter
3. ✅ **RESTful API** - Entegrasyon için
4. ✅ **Event-based bildirim** - Gerçek zamanlı
5. ✅ **Grafik raporlar** - Görsel analiz

### Öncelik 3: Ek Özellikler (İleride)
1. ❓ **Dijital pano** - Nöbet Yönetimi'nde var
2. ❓ **SMS bildirimi** - Opsiyonel
3. ❓ **Email bildirimi** - Opsiyonel
4. ❓ **Çoklu okul yönetimi** - Enterprise için
5. ❓ **Yardım/Dokümantasyon** - Kullanıcı desteği

### Öğretmen Pro'nun Mevcut Avantajları
1. ✅ **Modern teknoloji stack** (NestJS, PostgreSQL, Flutter)
2. ✅ **Event-driven architecture** (Inbox, Push)
3. ✅ **Modüler yapı** (MODULE_RULES.md)
4. ✅ **API-first yaklaşım** (API_CONTRACT.md)
5. ✅ **Rol bazlı yetkilendirme** (AUTHORITY_MATRIX.md)
6. ✅ **Modern UI** (Mosaic referans)

---

## 9. Sonraki Adımlar

### Kısa Vadeli (1-2 Hafta)
1. ✅ **Otomatik inceleme tamamlandı**
2. ⏳ **Yönetici hesabı ile manuel inceleme** - Kritik!
3. ⏳ **Eksik özellikleri keşfet**
4. ⏳ **Algoritmaları anla**
5. ⏳ **Karşılaştırma tablosunu tamamla**

### Orta Vadeli (1 Ay)
1. ⏳ **Öğretmen Pro nöbet modülü tasarımı**
2. ⏳ **Vekalet algoritması tasarımı**
3. ⏳ **Adalet metrikleri tasarımı**
4. ⏳ **UI/UX mockup'ları**
5. ⏳ **API endpoint'leri tasarımı**

### Uzun Vadeli (3-6 Ay)
1. ⏳ **Nöbet modülü geliştirme**
2. ⏳ **Mobil uygulama entegrasyonu**
3. ⏳ **Bildirim sistemi entegrasyonu**
4. ⏳ **Raporlama modülü**
5. ⏳ **Beta test ve iyileştirmeler**

---

## 10. Ekler

### Elde Edilen Veriler
- ✅ 8 adet screenshot
- ✅ Sayfa yapısı analizi
- ✅ Form ve input alanları
- ✅ Link ve navigasyon yapısı
- ✅ Teknik altyapı bilgileri

### Elde Edilemeyen Veriler
- ❌ Yönetici paneli ekran görüntüleri
- ❌ Nöbet planı oluşturma akışı
- ❌ Vekalet önerisi ekranı
- ❌ İstatistik ve raporlar
- ❌ Ayarlar sayfası
- ❌ Öğretmen yönetimi
- ❌ Ders programı yönetimi

### Gerekli Ek İncelemeler
1. **Yönetici hesabı ile giriş** - Tüm özellikleri görmek için
2. **Nöbet planı oluşturma** - Algoritma ve akışı anlamak için
3. **Vekalet sistemi** - Öneri algoritmasını görmek için
4. **İstatistikler** - Adalet metriklerini görmek için
5. **Ayarlar** - Sistem yapılandırmasını anlamak için

---

## 11. İletişim ve Paylaşım

### Ekiple Paylaşılacak
- ✅ Bu rapor
- ✅ Screenshot'lar (8 adet)
- ✅ Otomatik oluşturulan rapor (nobetyonetim-report.md)
- ⏳ Yönetici hesabı ile ek inceleme (gerekli)

### Toplantı Önerisi
**Konu:** Nöbet Yönetimi Sistemi İnceleme Bulguları

**Gündem:**
1. Otomatik inceleme sonuçları (10 dk)
2. Demo hesap sınırlamaları (5 dk)
3. Yönetici hesabı ile ek inceleme planı (5 dk)
4. Öğretmen Pro için öneriler (10 dk)
5. Sonraki adımlar ve önceliklendirme (10 dk)
6. Soru-cevap (10 dk)

**Toplam Süre:** 50 dakika

---

**Hazırlayan:** AI Assistant  
**Tarih:** 19 Şubat 2026  
**Versiyon:** 1.0  
**Durum:** Otomatik inceleme tamamlandı, yönetici hesabı ile manuel inceleme bekleniyor

---

## Notlar

- ✅ Selenium başarıyla kuruldu ve çalıştırıldı
- ✅ ChromeDriver otomatik indirildi (webdriver-manager)
- ✅ 8 sayfa başarıyla tarandı
- ✅ Screenshot'lar alındı
- ⚠️ Demo hesap çok sınırlı, yönetici hesabı gerekli
- ⚠️ Kritik özellikler (algoritma, vekalet, istatistik) görüntülenemedi
- 📌 Yönetici hesabı için okul yöneticisinden yardım istenebilir
- 📌 Alternatif: Kendi okul hesabı oluşturup test edilebilir
