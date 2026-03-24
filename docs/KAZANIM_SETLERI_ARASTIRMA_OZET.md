# Kazanım Setleri Modülü – Araştırma Özeti ve Öneriler

**Tarih:** 2025-02  
**Hedef:** Kazanım Cepte benzeri yapıda superadmin tarafı kazanım setleri modülü.

---

## 1. Mevcut Durum

### 1.1 Proje İçi

| Bileşen | Durum | Not |
|---------|-------|-----|
| **Web-admin** `/outcome-sets` | Placeholder | Sadece açıklama metni; işlev yok |
| **Backend** outcome-sets API | YOK | API_CONTRACT'ta tanımlı ama implementasyon yok |
| **OutcomeSet entity** | Konsept | CORE_ENTITIES.md'de; DB tablosu muhtemelen yok |
| **yillik_plan_icerik** | Var | subject_code, grade, week_order, kazanimlar – kazanım kaynağı |
| **curriculum-kazanimlar** | Kısmen | Coğrafya 9–10, Matematik 9 MEB metinleri |
| **EVRAK_CALISMA_TAKVIMI_COZUM.md** | Var | "Yıllık plandan içe aktar" akışı tanımlı |

### 1.2 Kazanım Cepte Uygulaması (Referans)

- **Platform:** iOS / Android mobil
- **İçerik:** Derslerin kazanımlarına erişim
- **Özellikler:**
  - Sınıf + ders seçimi → haftaya göre kazanımlar
  - Bulunduğunuz haftanın kazanımı otomatik açılır
  - Favori ekleme
  - Kazanım başına not ekleme
  - Ders programı oluşturma, çizelge, çıktı
  - Veli toplantısı, zümre, kulüp vb. hazır dosyalar
  - İş takvimi / tatil takibi

**Kazanım Cepte yapısı (özet):** Sınıf → Ders → Hafta → Kazanımlar (hafta bazlı hiyerarşi).

---

## 2. Önerilen Yapı (Kazanım Cepte Benzeri)

### 2.1 Veri Modeli

```
OutcomeSet (kazanım seti)
├── id, subject_code, subject_label, grade, section?, academic_year?
├── source_type: 'manual' | 'yillik_plan' | 'curriculum'
├── source_plan_id?  (yillik_plan_icerik meta referansı)
└── items: OutcomeItem[]

OutcomeItem (tek kazanım)
├── id, outcome_set_id
├── week_order?       (hangi hafta - Kazanım Cepte tarzı)
├── unite?            (ünite/tema)
├── code              (COĞ.9.1.1)
├── description       (tam metin)
└── sort_order
```

**Neden hafta bilgisi:** Kazanım Cepte hafta bazlı gösterim yapıyor; öğretmen "bu hafta hangi kazanımlar" sorusuna cevap veriyor. `yillik_plan_icerik` zaten `week_order` ile hafta bilgisi taşıyor.

### 2.2 Superadmin Akışları

| Akış | Açıklama |
|------|----------|
| **1. Yeni set oluştur** | Ders, sınıf, öğretim yılı seç → boş veya curriculum’dan doldur |
| **2. Yıllık plandan içe aktar** | Ders + Sınıf + Öğretim yılı → `yillik_plan_icerik` satırlarından `kazanimlar` → OutcomeItem’lara dönüştür (week_order korunur) |
| **3. MEB curriculum’dan** | `curriculum-kazanimlar.ts` varsa ders/sınıf için direkt set oluştur |
| **4. Elle düzenleme** | OutcomeItem ekle/sil/düzenle, sıra değiştir |

### 2.3 Öğretmen Tarafı (İleride)

- Set listesi (kendi dersleri/sınıfları)
- Hafta bazlı görünüm (Kazanım Cepte gibi)
- İşlendi / kısmen / ertelendi işaretleme
- Not ekleme
- Favoriler (opsiyonel)

---

## 3. Uygulama Önerisi (Fazlar)

### Faz 1 – Backend + Veritabanı (Öncelik)

1. **Migration:**
   - `outcome_set` tablosu: id, subject_code, subject_label, grade, section, academic_year, source_type, created_at, updated_at
   - `outcome_item` tablosu: id, outcome_set_id, week_order, unite, code, description, sort_order

2. **API (superadmin):**
   - `GET /outcome-sets` – liste (filtre: subject_code, grade, academic_year)
   - `POST /outcome-sets` – yeni set
   - `GET /outcome-sets/:id` – set + items
   - `PATCH /outcome-sets/:id` – set güncelle
   - `DELETE /outcome-sets/:id` – set sil
   - `POST /outcome-sets/import-from-plan` – yıllık plandan içe aktar (body: subject_code, grade, academic_year)

3. **Import servisi:** `YillikPlanIcerikService` ile ilgili plan satırlarını çek → `kazanimlar` alanını parse (madde madde veya tek metin) → OutcomeItem oluştur.

### Faz 2 – Web-admin Superadmin UI

1. **Liste sayfası** (`/outcome-sets`):
   - Filtre: Ders, sınıf, öğretim yılı
   - Tablo: Set adı (ders + sınıf + yıl), kazanım sayısı, kaynak, işlemler
   - "Yeni set" butonu

2. **Set oluştur/düzenle modal veya sayfa:**
   - Ders (document-template-subjects veya MEB kataloğu)
   - Sınıf (1–12)
   - Bölüm (ders / secmeli / iho – opsiyonel)
   - Öğretim yılı
   - **Kaynak seçimi:**
     - "Yıllık plandan içe aktar" → Ders/sınıf/yıl seç → import
     - "MEB curriculum’dan" (varsa) → curriculum-kazanimlar’dan doldur
     - "Boş set" → elle ekle

3. **Kazanım listesi düzenleme:**
   - Hafta / ünite / kod / açıklama sütunları
   - Sıra değiştirme, ekleme, silme
   - Uzun metin: önizleme + detay (yillik-plan-icerik tarzı)

### Faz 3 – Öğretmen (MVP sonrası)

- Teacher endpoint’ler: `GET /outcome-sets` (filtre), `GET /outcomes` (ilerleme)
- Mobil / web öğretmen arayüzü

---

## 4. Kazanım Parse Stratejisi

`yillik_plan_icerik.kazanimlar` metin formatı değişken olabilir:

- `COĞ.9.1.1. Coğrafya biliminin konusu...\na) ...\nb) ...`
- Madde madde (a, b, c veya 1, 2, 3)
- Birden fazla kazanım aynı hücrede (satır sonu ile ayrılmış)

**Öneri:**

1. Satır sonu ile böl (her blok = potansiyel kazanım)
2. Kod regex: `[A-ZÖÇĞÜŞİ]{2,}\.\d+\.\d+\.\d+` (COĞ.9.1.1, MAT.9.2.1 vb.)
3. Kod yoksa: ilk cümle veya tam metni tek OutcomeItem olarak kaydet
4. `week_order` ve `unite` → ilgili `yillik_plan_icerik` satırından al

---

## 5. Referans Dosyalar

| Dosya | İçerik |
|-------|--------|
| `docs/EVRAK_CALISMA_TAKVIMI_COZUM.md` | Kazanım modülü, yıllık plandan import |
| `backend/src/config/curriculum-kazanimlar.ts` | MEB kazanım tam metinleri |
| `backend/src/yillik-plan-icerik` | Plan CRUD, kazanimlar alanı |
| `CORE_ENTITIES.md` | OutcomeSet, OutcomeProgress |
| `API_CONTRACT.md` | /outcome-sets, /outcomes endpointleri |

---

## 6. Sonuç

- **Önce araştırma:** Tamamlandı.
- **Önerilen sıra:** Faz 1 (Backend + migration) → Faz 2 (Web-admin superadmin UI).
- **Fark:** Kazanım Cepte hafta bazlı; mevcut `yillik_plan_icerik` zaten hafta bilgisi taşıyor. Import sırasında `week_order` korunursa öğretmen tarafında "bu haftanın kazanımları" görünümü mümkün.

Sonraki adım: Migration ve outcome-sets backend modülünün implementasyonu.

---

## 7. Defterdoldur.com İncelemesi (UI/UX Referans)

Kaynak: [Defterdoldur - Öğretmen Platformu](https://defterdoldur.com/)

### 7.1 Genel Yapı

| Bölüm | Açıklama |
|-------|----------|
| **Branşlar** | Sol/sidebar: Her branş = link + plan sayısı (örn: Coğrafya 25, Matematik 25). URL: `/bransgetir/{id}/{slug}` |
| **Sınıflar** | 1–12 yuvarlak butonlar, tıklanınca sınıf bazlı planlar |
| **Hızlı Erişim** | Kartlar: Yıllık Planlar, Kazanım Ara, Günlük Planlar, Öğretmen Topluluğu |
| **Akademik Takvim** | Geçen / Kalan %, Bu Hafta, Ara Tatil, Yarıyıl blokları |
| **En Çok Kullanılan** | Günlük Planlar, Kazanım Ara, Ders Programı, Aylık Ders Raporu vb. link listesi |
| **MEB Haberleri** | Carousel slider; DÖGM, YYEGM, ORGM vb. kurum bazlı duyurular |
| **Son Paylaşımlar** | Öğretmen paylaşım kartları (sınıf, başlık, link) |

### 7.2 Kazanım Ara (/plan) Sayfası

- **Ders seçici:** Tek, büyük dropdown; format: `Ders Adı (varyant)-Sınıf`
  - Örnekler: `Coğrafya (AL-MEB)-9`, `Matematik (MEB)-5`, `Türkçe (MEB)-5`
  - Varyantlar: MEB, AL (Anadolu Lisesi), FL (Fen Lisesi), SBL (Sosyal Bilimler), Mesem, (Yeni*)
  - Ders + sınıf tek seçimde birleşik
- **Erişim:** Giriş zorunlu; modal: "Değerli Öğretmenim, bu bölüm kayıtlı kullanıcılar içindir"
- **Branş kapsamı:** 80+ branş; kültür, meslek, MESEM, rehberlik ayrımı

### 7.3 Kart ve Bölüm Yapısı (Modülümüz İçin Öneriler)

| Öğe | Defterdoldur | Bizim modül önerisi |
|-----|--------------|----------------------|
| **Set listesi** | Branş grid (ad + sayı) | Ders + sınıf kartları; kazanım sayısı badge |
| **Filtre** | Branş / Sınıf ayrı | Ders dropdown + sınıf (1–12) + öğretim yılı |
| **Hızlı erişim** | Kart grid | "Yıllık plandan içe aktar", "Yeni set", "MEB curriculum" aksiyon kartları |
| **İçerik kartı** | Plan başlık + kısa önizleme | Set: Ders, sınıf, yıl, kazanım sayısı; düzenle/sil ikonları |
| **Sınıf seçici** | 1–12 butonlar | Aynı: 1–12 badge/buton |

### 7.4 Görsel Stil Özeti

- Branş listesi: Link + sağda sayı (plan adedi)
- Kartlar: Başlık + kısa açıklama + ikon
- Akademik takvim: İlerleme çubuğu (Geçen % / Kalan %), "Bu Hafta" vurgusu
- Mobil: App Store / Google Play linkleri

### 7.5 Superadmin Kazanım Setleri Sayfası Önerisi (Defterdoldur Esinli)

**Üst bölüm – Hızlı aksiyon kartları:**
- "Yeni Set Oluştur" (Plus ikon)
- "Yıllık Plandan İçe Aktar" (Import ikon)
- "MEB Curriculum'dan" (varsa, BookOpen ikon)

**Filtre satırı:**
- Ders seçici (dropdown; document-template-subjects veya MEB kataloğu)
- Sınıf (1–12 butonlar veya dropdown)
- Öğretim yılı (2024-2025, 2025-2026 dropdown)

**Set listesi – Kart grid veya tablo:**
- Her satır: Ders | Sınıf | Öğretim yılı | Kazanım sayısı | Kaynak | İşlemler (düzenle, sil)
- Kart görünümünde: Ders + sınıf + yıl başlık; altında kazanım sayısı badge; sağ alt köşe: düzenle/sil

**Detay/Modal – Set düzenleme:**
- Kazanım listesi tablosu: Hafta | Ünite | Kod | Açıklama | Sıra
- Uzun metin: önizleme + "devam" ile açılır (yillik-plan-icerik tarzı)
