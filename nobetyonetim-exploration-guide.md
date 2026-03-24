# Nöbet Yönetimi Sistemi - Detaylı İnceleme Kılavuzu

## Giriş Bilgileri
- **URL:** https://www.nobetyonetim.net/Account/Login
- **Kurum Kodu:** 123456
- **Şifre:** 123456
- **Okul Tipi:** ORTAOKUL (Middle School)

## Sistemden Öğrenilen İlk Bilgiler

### Giriş Sistemi
- İki tip giriş var:
  1. **Kurum Kodu ile giriş:** Sadece atanan görevleri görme (öğretmen görünümü)
  2. **Cep telefonu numarası ile giriş:** Yönetici ayarlarına erişim (okul yöneticisi görünümü)
- Demo hesap: Kurum Kodu = 123456, Şifre = 123456

---

## İnceleme Planı (Adım Adım)

### 1. Dashboard / Ana Sayfa
**Aranacak Özellikler:**
- [ ] Bugünün nöbet listesi widget'ı
- [ ] Haftalık nöbet özeti
- [ ] Öğretmen bazında nöbet sayısı istatistikleri
- [ ] Yaklaşan nöbet uyarıları
- [ ] Eksik/boş nöbet slotları uyarısı
- [ ] Hızlı aksiyonlar (Nöbet Ekle, Öğretmen Gelmedi, vb.)

**Ekran Görüntüsü Alınacak:**
- Ana dashboard tam görünüm
- Her widget'ın detayı

**Sorulacak Sorular:**
- Hangi istatistikler öne çıkarılıyor?
- Kullanıcı hangi hızlı aksiyonları yapabiliyor?
- Bildirim sistemi var mı?

---

### 2. Nöbet Planı / Duty Schedule
**Aranacak Özellikler:**

#### 2.1 Nöbet Planı Oluşturma
- [ ] Haftalık/aylık/yıllık plan oluşturma seçeneği
- [ ] Nöbet yerleri (duty areas) seçimi
- [ ] Ders saati (lesson hour) bazında nöbet atama
  - Örn: "Sabah nöbeti: 08:00-08:40", "Teneffüs 1: 09:30-09:40", vb.
- [ ] Öğretmen seçimi ve filtreleme
  - Müsait öğretmenler (o saatte dersi olmayan)
  - Nöbet sayısı dengeleme
  - Özel durumlar (hamile, engelli, vb.)
- [ ] Otomatik plan oluşturma algoritması
  - Adil dağılım mantığı
  - Kısıtlamalar (aynı gün birden fazla nöbet yasak, vb.)
- [ ] Manuel düzenleme imkanı
- [ ] Plan onaylama/yayınlama süreci

#### 2.2 Nöbet Planı Görüntüleme
- [ ] Takvim görünümü (günlük/haftalık/aylık)
- [ ] Liste görünümü
- [ ] Öğretmen bazında görünüm
- [ ] Nöbet yeri bazında görünüm
- [ ] Filtreleme seçenekleri
- [ ] Arama fonksiyonu

#### 2.3 Nöbet Planı Düzenleme
- [ ] Tek nöbet değiştirme
- [ ] Toplu değişiklik
- [ ] Nöbet takas etme
- [ ] Nöbet iptal etme
- [ ] Değişiklik geçmişi

**Ekran Görüntüsü Alınacak:**
- Nöbet planı oluşturma ekranı
- Ders saati seçimi arayüzü
- Öğretmen seçimi filtreleri
- Takvim görünümü
- Liste görünümü

**Sorulacak Sorular:**
- Ders saati bazında nöbet ataması nasıl yapılıyor?
- Otomatik plan oluşturma algoritması nasıl çalışıyor?
- Hangi kısıtlamalar var?
- Öğretmen müsaitlik kontrolü nasıl yapılıyor?

---

### 3. Öğretmen Gelmedi / Absent Teacher (Vekalet Sistemi)
**Aranacak Özellikler:**

#### 3.1 Öğretmen Yokluk İşlemi
- [ ] Öğretmen seçimi
- [ ] Tarih ve ders saati seçimi
- [ ] Yokluk nedeni (izinli, hastalık, vb.)
- [ ] Kaç ders saati eksik olacak?

#### 3.2 Vekalet Önerisi Sistemi
- [ ] **Otomatik öneri algoritması:**
  - O saatte dersi olmayan öğretmenler
  - Aynı branştan öğretmenler (öncelik)
  - Nöbet yükü dengesi
  - Coğrafi yakınlık (aynı kat/bina)
- [ ] **Öneri listesi görünümü:**
  - Öğretmen adı
  - Branş
  - O saatteki durumu (boş ders saati mi?)
  - Mevcut vekalet sayısı
  - Nöbet yükü skoru
- [ ] **Manuel seçim:**
  - Listeden öğretmen seçme
  - Birden fazla öğretmen atama (farklı saatler için)
- [ ] **Bildirim:**
  - Atanan öğretmene bildirim gönderme
  - SMS/Email/Push notification

#### 3.3 Vekalet Takibi
- [ ] Vekalet geçmişi
- [ ] Öğretmen bazında vekalet sayısı
- [ ] Vekalet istatistikleri
- [ ] Ağırlıklı sayım (weighted counting)
  - Örn: Kendi branşı = 1 puan, farklı branş = 1.5 puan

**Ekran Görüntüsü Alınacak:**
- Öğretmen gelmedi işlemi ekranı
- Vekalet önerisi listesi
- Öğretmen detay bilgileri
- Bildirim gönderme ekranı

**Sorulacak Sorular:**
- Vekalet önerisi algoritması nasıl çalışıyor?
- Hangi kriterlere göre sıralama yapılıyor?
- Ders saati bilgisi nereden geliyor?
- Ağırlıklı sayım var mı?
- Bildirim sistemi nasıl çalışıyor?

---

### 4. İstatistikler / Statistics
**Aranacak Özellikler:**

#### 4.1 Nöbet İstatistikleri
- [ ] Öğretmen bazında nöbet sayısı
- [ ] Nöbet yeri bazında dağılım
- [ ] Zaman bazında dağılım (haftalık/aylık)
- [ ] Adalet skoru (fairness metrics)
  - Standart sapma
  - Min/max farkı
  - Hedef nöbet sayısına göre sapma

#### 4.2 Vekalet İstatistikleri
- [ ] Öğretmen bazında vekalet sayısı
- [ ] Branş bazında vekalet sayısı
- [ ] Ağırlıklı vekalet sayımı
  - Kendi branşı
  - Farklı branş
  - Toplam ağırlıklı puan
- [ ] Vekalet nedenleri dağılımı
- [ ] En çok vekalet yapan öğretmenler
- [ ] En az vekalet yapan öğretmenler

#### 4.3 Raporlama
- [ ] Grafik görünümü (bar, pie, line charts)
- [ ] Tablo görünümü
- [ ] Excel export
- [ ] PDF export
- [ ] Tarih aralığı filtreleme
- [ ] Öğretmen/branş filtreleme

**Ekran Görüntüsü Alınacak:**
- İstatistik dashboard'u
- Her bir grafik/tablo
- Filtre seçenekleri
- Export seçenekleri

**Sorulacak Sorular:**
- Hangi adalet metrikleri kullanılıyor?
- Ağırlıklı sayım nasıl hesaplanıyor?
- Hedef nöbet sayısı nasıl belirleniyor?
- Raporlar hangi formatlarda indirilebiliyor?

---

### 5. Ders Programı / Timetable
**Aranacak Özellikler:**

#### 5.1 Ders Programı Girişi
- [ ] **Giriş yöntemi:**
  - Manuel giriş (öğretmen + gün + saat + ders)
  - Excel import
  - Toplu kopyalama
- [ ] **Veri yapısı:**
  - Öğretmen
  - Gün (Pazartesi-Cuma)
  - Ders saati (1-8 veya saat aralığı)
  - Ders adı/branş
  - Sınıf
  - Derslik
- [ ] **Validasyon:**
  - Çakışma kontrolü (aynı öğretmen, aynı saat)
  - Boş saat kontrolü
  - Ders saati limiti

#### 5.2 Ders Programı Görüntüleme
- [ ] Öğretmen bazında haftalık program
- [ ] Sınıf bazında haftalık program
- [ ] Derslik bazında haftalık program
- [ ] Boş ders saatleri görünümü
- [ ] Çakışma uyarıları

#### 5.3 Ders Programı Düzenleme
- [ ] Tek ders değiştirme
- [ ] Toplu değişiklik
- [ ] Kopyalama/yapıştırma
- [ ] Silme
- [ ] Geçmiş dönem kopyalama

**Ekran Görüntüsü Alınacak:**
- Ders programı giriş ekranı
- Excel import arayüzü
- Haftalık program görünümü
- Boş ders saatleri listesi

**Sorulacak Sorular:**
- Ders programı nasıl girilir?
- Excel formatı nasıl olmalı?
- Boş ders saatleri nasıl tespit ediliyor?
- Çakışma kontrolü nasıl yapılıyor?

---

### 6. Nöbet Yerleri / Duty Areas
**Aranacak Özellikler:**

#### 6.1 Nöbet Yeri Tanımlama
- [ ] Nöbet yeri adı (örn: Ana Kapı, Bahçe, Kantin, Kat 1, vb.)
- [ ] Nöbet yeri tipi (sabah, teneffüs, öğle, akşam)
- [ ] Gerekli öğretmen sayısı
- [ ] Aktif/pasif durumu
- [ ] Öncelik sırası

#### 6.2 Nöbet Yeri Yönetimi
- [ ] Ekleme
- [ ] Düzenleme
- [ ] Silme
- [ ] Sıralama
- [ ] Toplu işlemler

**Ekran Görüntüsü Alınacak:**
- Nöbet yerleri listesi
- Nöbet yeri ekleme/düzenleme formu

**Sorulacak Sorular:**
- Nöbet yeri tipleri neler?
- Gerekli öğretmen sayısı nasıl belirleniyor?
- Nöbet yerleri nöbet planına nasıl entegre ediliyor?

---

### 7. Öğretmen Yönetimi
**Aranacak Özellikler:**

#### 7.1 Öğretmen Listesi
- [ ] Öğretmen adı/soyadı
- [ ] Branş
- [ ] Telefon/email
- [ ] Aktif/pasif durumu
- [ ] Özel durumlar (hamile, engelli, vb.)
- [ ] Nöbet muafiyeti
- [ ] Toplam nöbet sayısı
- [ ] Toplam vekalet sayısı

#### 7.2 Öğretmen Ekleme/Düzenleme
- [ ] Temel bilgiler
- [ ] Branş seçimi
- [ ] İletişim bilgileri
- [ ] Özel durum işaretleme
- [ ] Nöbet muafiyeti tanımlama
- [ ] Toplu import (Excel)

#### 7.3 Öğretmen Detay Sayfası
- [ ] Genel bilgiler
- [ ] Ders programı
- [ ] Nöbet geçmişi
- [ ] Vekalet geçmişi
- [ ] İstatistikler

**Ekran Görüntüsü Alınacak:**
- Öğretmen listesi
- Öğretmen ekleme/düzenleme formu
- Öğretmen detay sayfası

---

### 8. Ayarlar / Settings
**Aranacak Özellikler:**

#### 8.1 Genel Ayarlar
- [ ] Okul adı
- [ ] Okul tipi (ilkokul, ortaokul, lise)
- [ ] Eğitim-öğretim yılı
- [ ] Dönem (güz/bahar)
- [ ] Haftalık çalışma günleri
- [ ] Ders saatleri tanımları

#### 8.2 Nöbet Ayarları
- [ ] Nöbet planı oluşturma algoritması ayarları
- [ ] Adalet skoru hesaplama yöntemi
- [ ] Otomatik bildirim ayarları
- [ ] Vekalet öneri algoritması ayarları
- [ ] Ağırlıklı sayım katsayıları

#### 8.3 Bildirim Ayarları
- [ ] SMS bildirimi
- [ ] Email bildirimi
- [ ] Push notification
- [ ] Bildirim şablonları

#### 8.4 Kullanıcı Yönetimi
- [ ] Kullanıcı listesi
- [ ] Rol tanımları (admin, öğretmen, vb.)
- [ ] Yetki yönetimi

**Ekran Görüntüsü Alınacak:**
- Ayarlar ana sayfası
- Her ayar kategorisi

---

### 9. Diğer Özellikler
**Aranacak Özellikler:**
- [ ] Takvim entegrasyonu
- [ ] Mobil uygulama
- [ ] API dokümantasyonu
- [ ] Yardım/Dokümantasyon
- [ ] Destek sistemi
- [ ] Çoklu okul yönetimi (varsa)
- [ ] Raporlama modülü
- [ ] Dışa aktarma seçenekleri

---

## Karşılaştırma Tablosu (Öğretmen Pro vs Nöbet Yönetimi)

| Özellik | Nöbet Yönetimi | Öğretmen Pro | Notlar |
|---------|----------------|--------------|--------|
| **Nöbet Planı Oluşturma** | ? | ✓ (Planlı) | |
| **Ders Saati Bazında Nöbet** | ? | ✓ (Planlı) | |
| **Otomatik Nöbet Dağılımı** | ? | ✓ (Planlı) | |
| **Vekalet Önerisi** | ? | ✓ (Planlı) | |
| **Boş Ders Saati Filtresi** | ? | ✓ (Planlı) | |
| **Ağırlıklı Vekalet Sayımı** | ? | ✓ (Planlı) | |
| **Adalet İstatistikleri** | ? | ✓ (Planlı) | |
| **Ders Programı Yönetimi** | ? | ✓ (Planlı) | |
| **Bildirim Sistemi** | ? | ✓ (Var) | |
| **Mobil Uygulama** | ? | ✓ (Planlı) | |
| **Excel Import/Export** | ? | ✓ (Planlı) | |

---

## İnceleme Sonrası Rapor Şablonu

### 1. Genel İzlenimler
- Kullanıcı arayüzü kalitesi (1-10):
- Kullanım kolaylığı (1-10):
- Özellik zenginliği (1-10):
- Performans (1-10):

### 2. Öne Çıkan Özellikler
1. 
2. 
3. 

### 3. Eksik Gördüğümüz Özellikler
1. 
2. 
3. 

### 4. Öğretmen Pro'ya Eklenebilecek Özellikler
1. 
2. 
3. 

### 5. Öğretmen Pro'nun Avantajları
1. 
2. 
3. 

### 6. Teknik Detaylar
- Frontend teknolojisi:
- Backend teknolojisi (tahmin):
- Veritabanı (tahmin):
- Mobil uygulama:
- API:

---

## Ekran Görüntüleri Listesi

Her bölüm için alınacak ekran görüntüleri:

1. **Login sayfası** ✓
2. **Dashboard** - Ana sayfa
3. **Nöbet Planı** - Liste görünümü
4. **Nöbet Planı** - Takvim görünümü
5. **Nöbet Planı** - Oluşturma ekranı
6. **Nöbet Planı** - Ders saati seçimi
7. **Öğretmen Gelmedi** - Ana ekran
8. **Öğretmen Gelmedi** - Vekalet önerisi listesi
9. **İstatistikler** - Dashboard
10. **İstatistikler** - Nöbet dağılımı
11. **İstatistikler** - Vekalet dağılımı
12. **Ders Programı** - Giriş ekranı
13. **Ders Programı** - Görüntüleme
14. **Nöbet Yerleri** - Liste
15. **Öğretmen Yönetimi** - Liste
16. **Öğretmen Yönetimi** - Detay
17. **Ayarlar** - Genel
18. **Ayarlar** - Nöbet ayarları

---

## Notlar ve Gözlemler

(İnceleme sırasında not alınacak alan)

---

## Sonraki Adımlar

1. Bu kılavuza göre sistemi manuel olarak inceleyin
2. Her bölüm için ekran görüntüsü alın
3. Notlar bölümüne gözlemlerinizi yazın
4. Karşılaştırma tablosunu doldurun
5. Rapor şablonunu tamamlayın
6. Öğretmen Pro için özellik listesi oluşturun

---

**Hazırlayan:** AI Assistant  
**Tarih:** 19 Şubat 2026  
**Versiyon:** 1.0
