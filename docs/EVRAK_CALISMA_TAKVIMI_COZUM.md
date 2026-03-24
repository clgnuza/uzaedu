# Evrak Modülü – Çalışma Takvimi ve Yıllık Plan Çözüm Önerisi

**Amaç:** Superadmin çalışma takvimini ve yıllık plan içeriğini yıla göre yönetebilsin. Plan verisi Kazanım modülüne de kaynak olsun. Şablonlar (Excel/Word/PDF) **kesinlikle bozulmasın**. Çok ders için GPT ile taslak üretilebilsin.

---

## 1. Veri Modeli

### 1.1 work_calendar (Çalışma Takvimi)

Her öğretim yılı için hafta bazlı takvim. Superadmin CRUD.

| Alan | Tip | Açıklama |
|------|-----|----------|
| id | uuid | PK |
| academic_year | varchar(16) | 2024-2025, 2025-2026 |
| week_order | int | Hafta sırası (1–36) |
| week_start | date | Hafta başlangıç (Pzt) |
| week_end | date | Hafta bitiş (Cuma) |
| ay | varchar(32) | EYLÜL, EKİM, KASIM... |
| hafta_label | varchar(64) | "1. Hafta: 8-12 Eylül" |
| is_tatil | boolean | Tatil haftası mı? |
| tatil_label | varchar(128) | "1. DÖNEM ARA TATİLİ: 10-14 Kasım" |
| sort_order | int | Sıralama |

**Örnek:** 2025-2026 için 36 hafta; 8–9. hafta arası "1. DÖNEM ARA TATİLİ" satırı eklenir.

---

### 1.2 yillik_plan_icerik (Yıllık Plan İçeriği)

Ders/sınıf/yıl bazlı plan satırları. Superadmin CRUD. Kazanım modülü bu veriyi kullanır.

| Alan | Tip | Açıklama |
|------|-----|----------|
| id | uuid | PK |
| subject_code | varchar(64) | MEB ders kodu (cografya, matematik...) |
| subject_label | varchar(128) | Coğrafya, Matematik |
| grade | int | 1–12 |
| section | varchar(16) | ders, secmeli, iho (5–8 için) |
| academic_year | varchar(16) | 2024-2025 |
| week_order | int | Hafta sırası (work_calendar ile eşleşir) |
| unite | varchar(256) | Ünite adı |
| konu | varchar(512) | Konu başlığı |
| kazanimlar | text / jsonb | Kazanımlar (madde madde veya JSON array) |
| ders_saati | int | O hafta ders saati |
| sort_order | int | Satır sırası |

**Kazanım modülü entegrasyonu:** `kazanimlar` alanı OutcomeSet/OutcomeItem için kaynak olur. Kazanım sayfasında "Yıllık plandan içe aktar" ile bu veriden set oluşturulabilir.

---

## 2. Şablon Koruma Stratejisi

**Kural:** Excel/Word/PDF şablonlarında **sadece mevcut placeholder’lar metin olarak değiştirilir**. Satır ekleme/çıkarma, merge değiştirme, stil değiştirme yok.

### 2.1 Mevcut Merge Yöntemi (Korunacak)

- **Excel:** PizZip ile `xl/sharedStrings.xml` ve `xl/worksheets/sheetN.xml` içinde `{key}` → `value` replace
- **Word:** docxtemplater – `{placeholder}` değiştirme
- Merged cells, kolon genişliği, stiller **korunur** (XML’de sadece metin değişir)

### 2.2 Yıllık Plan İçin Placeholder Stratejisi

**Sabit satır sayısı yaklaşımı:** Şablonda N hafta için önceden tanımlı satırlar olur (örn. 36 hafta).

| Yöntem | Açıklama | Avantaj | Dezavantaj |
|--------|----------|---------|------------|
| **A) Slot placeholder’ları** | `{hafta_1}`, `{ay_1}`, `{konu_1}`, `{kazanim_1}`, `{saat_1}` … `{hafta_36}` | Şablon yapısı hiç bozulmaz, mevcut merge ile uyumlu | 36 haftadan fazla zor; boş haftalar boş string |
| **B) SheetJS hücre güncelleme** | Template oku, sadece belirli hücrelere yaz, format kopyala | Esnek satır sayısı | Dikkatli kod gerekir, merged cell sınırlamaları |
| **C) docxtemplater-xlsx (500€/yıl)** | Loop desteği: `{#weeks}{...}{/weeks}` | En esnek, Word ile aynı mantık | Ücretli |

**Öneri: A) Slot placeholder’ları**

- Şablonda 36 veri satırı olur (SÜRE/AY/HAFTA/DERS SAATİ/ÜNİTE/KONU/KAZANIM kolonları)
- Her satırda: `{hafta_N}`, `{ay_N}`, `{konu_N}`, `{kazanim_N}`, `{saat_N}` (N=1..36)
- `work_calendar` + `yillik_plan_icerik` verisiyle merge data oluşturulur
- Eksik haftalar boş string ile doldurulur
- **Şablon dosyasına dokunulmaz**, sadece metin replace

**Hafta tarihi:** `work_calendar.hafta_label` → `{hafta_1}` = "1. Hafta: 8-12 Eylül"

---

## 3. Modül Akışı

### 3.1 Superadmin – Çalışma Takvimi

1. **Ayarlar** veya **Evrak** altında "Çalışma Takvimi"
2. Öğretim yılı seç (2024-2025, 2025-2026)
3. Hafta listesi: Başlangıç/bitiş tarihi, ay, tatil bilgisi
4. "MEB takviminden doldur" (opsiyonel): Varsayılan MEB tarihleriyle otomatik doldurma
5. Elle düzenleme, kaydet

### 3.2 Superadmin – Yıllık Plan İçeriği

1. **Evrak** → "Yıllık Plan İçerikleri"
2. Ders + Sınıf + Öğretim yılı seç
3. Hafta bazlı tablo: Ünite, Konu, Kazanımlar, Ders saati
4. **"GPT ile taslak oluştur"** butonu:
   - MEB müfredat referansı + ders + sınıf + yıl
   - GPT’den haftalık taslak al
   - Superadmin düzenleyip kaydeder
5. Toplu Excel import (opsiyonel): Hafta, konu, kazanım sütunlarıyla yükleme

### 3.3 Öğretmen – Evrak Üret

1. Planlar → Sınıf → Ders → Öğretim yılı
2. Şablon listesi → "Üret"
3. Form: okul, müdür, zümre, onay tarihi (mevcut)
4. Backend: `work_calendar` + `yillik_plan_icerik` verisini merge data’ya ekler
5. `{hafta_1}` … `{hafta_36}` placeholder’ları doldurulur
6. Merge edilmiş Excel indirilir

### 3.4 Kazanım Modülü

1. **Kazanım Setleri** sayfasında "Yeni Set" veya mevcut set düzenleme
2. "Yıllık plandan içe aktar" seçeneği:
   - Ders + Sınıf + Öğretim yılı seç
   - `yillik_plan_icerik` tablosundan `kazanimlar` çekilir
   - OutcomeItem’lara dönüştürülür
3. Öğretmen bu set üzerinden ilerleme işaretler (mevcut OutcomeProgress mantığı)

---

## 4. GPT Entegrasyonu

### 4.1 Endpoint

```
POST /yillik-plan-icerik/generate-draft
Body: {
  subject_code: string,
  subject_label: string,
  grade: number,
  section?: string,
  academic_year: string,
  curriculum_ref?: string  // opsiyonel: "MEB 2024 Coğrafya"
}
Response: {
  items: [{ week_order, unite, konu, kazanimlar, ders_saati }]
}
```

### 4.2 GPT Prompt (özet)

- MEB X. sınıf Y dersi yıllık plan taslağı
- 36 hafta, hafta bazlı konu + kazanım + ders saati
- Türkçe, MEB terminolojisi
- `work_calendar` bilgisi (tatil haftaları) prompt’a eklenebilir

### 4.3 Güvenlik

- Sadece superadmin (veya moderator + document_templates)
- Rate limit (örn. 10/dakika)
- OpenAI/Anthropic API key .env’den

---

## 5. Fazlama Planı

### Faz 1 – Veri + CRUD (şablon değişikliği yok)

- [ ] `work_calendar` entity + migration
- [ ] `yillik_plan_icerik` entity + migration
- [ ] Backend: GET/POST/PATCH/DELETE `/work-calendar`, `/yillik-plan-icerik`
- [ ] Superadmin: Çalışma Takvimi sayfası (basit tablo CRUD)
- [ ] Superadmin: Yıllık Plan İçerikleri sayfası (ders/sınıf/yıl seç → hafta tablosu CRUD)

### Faz 2 – Evrak Merge Entegrasyonu

- [ ] Coğrafya (veya bir ders) şablonuna `{hafta_1}` … `{hafta_36}` slot’ları eklenir
- [ ] `DocumentGenerateService.buildMergeData`: `work_calendar` + `yillik_plan_icerik` verisini merge data’ya ekler
- [ ] Test: Öğretmen plan ürettiğinde hafta/konu/kazanım dolu mu?
- [ ] Şablon yapısının korunduğu doğrulanır (merge, stil, satır sayısı)

### Faz 3 – GPT Taslak

- [ ] OpenAI/Anthropic SDK entegrasyonu
- [ ] `POST /yillik-plan-icerik/generate-draft` endpoint
- [ ] Superadmin UI: "GPT ile taslak oluştur" butonu → draft göster → kaydet

### Faz 4 – Kazanım Entegrasyonu

- [ ] Kazanım Setleri sayfasına "Yıllık plandan içe aktar"
- [ ] `yillik_plan_icerik` → OutcomeSet/OutcomeItem dönüşümü
- [ ] OutcomeSet’e `source_plan_id` veya `source_type: 'yillik_plan'` (opsiyonel)

### Faz 5 – Genişletme

- [ ] Tüm dersler için şablon + slot placeholder (veya master şablon)
- [ ] Toplu Excel import
- [ ] MEB takvim otomatik doldurma (config veya harici API)

---

## 6. Risk ve Önlemler

| Risk | Önlem |
|------|-------|
| Şablon bozulması | Sadece `{key}` metin replace; satır/hücre ekleme-çıkarma yok |
| 36’dan fazla hafta | MEB standart 36 hafta; istisna yıllarda şablon kopyası (38 hafta) |
| GPT hatalı üretim | Taslak olarak sunulur, superadmin mutlaka düzenler |
| Kazanım format uyumsuzluğu | `kazanimlar` text veya JSON; import sırasında parse |
| Çok ders yükü | GPT ile toplu taslak; import/export ile yedekleme |

---

## 7. Özet

- **work_calendar:** Yıla göre hafta takvimi (Superadmin CRUD)
- **yillik_plan_icerik:** Ders/sınıf/yıl bazlı konu-kazanım-saat (Superadmin CRUD)
- **Şablon:** Slot placeholder’ları (`{hafta_N}` vb.); mevcut XML replace ile güvenli merge
- **Kazanım:** `yillik_plan_icerik.kazanimlar` → OutcomeSet import
- **GPT:** Taslak üretim; superadmin onayı zorunlu

Bu yapı ile hem takvim hem plan içeriği yönetilebilir, şablonlar korunur, Kazanım modülü veri alır ve çok ders için GPT devreye alınabilir.
