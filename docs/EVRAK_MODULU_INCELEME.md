# Evrak Oluşturma Modülü – İnceleme ve Geliştirme Rehberi

**Güncelleme:** Bu oturum – backend ve web-admin analiz edildi.

---

## 1. Mimari Özet

```
Öğretmen (/evrak)          Superadmin (/document-templates, /yillik-plan-icerik)
       │                                    │
       │  Sınıf → Bölüm → Ders → Yıl        │  Şablon CRUD, Plan içeriği, Takvim
       │  "Planları Listele"                 │
       ▼                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  document-templates modülü (Backend)                                         │
│  • DocumentTemplatesController: liste, detay, indir, CRUD                    │
│  • DocumentsController: POST /documents/generate, POST /documents/preview    │
│  • DocumentGenerateService: merge (DOCX/Excel), yıllık plan runtime üretimi  │
│  • YillikPlanIcerikModule, WorkCalendarModule (plan verisi, tatil haftaları)│
└─────────────────────────────────────────────────────────────────────────────┘
       │
       ▼
R2 / local: şablon dosyaları → merge → signed URL → indirme
```

---

## 2. Backend Bileşenleri

### 2.1 Ana Dosyalar

| Dosya | Rol |
|-------|-----|
| `document-templates.service.ts` | Şablon CRUD, filtre (findAll), `section IS NULL` desteği |
| `document-generate.service.ts` | Merge, yıllık plan DOCX üretimi, önizleme (~1270 satır) |
| `documents.controller.ts` | `POST /documents/generate`, `POST /documents/preview` |
| `document-templates.controller.ts` | `GET /document-templates`, subjects, options, catalog |
| `document-catalog.service.ts` | Ders listesi (grade, section), evrak türleri |
| `yillik-plan-icerik` modülü | Plan içeriği (hafta bazlı satırlar) |
| `work-calendar` modülü | Çalışma takvimi, tatil haftaları |

### 2.2 Akış: Yıllık Plan Üretimi

1. **Öğretmen** sınıf, bölüm, ders, öğretim yılı seçer → "Planları Listele"
2. `GET /document-templates?type=yillik_plan&grade&section&subject_code&academic_year`
3. Eşleşen şablonlar listelenir; "Plan İste" tıklanır
4. Form (okul adı, müdür, zümre öğretmenleri vb.) doldurulur; evrak_defaults + profil otomatik
5. `POST /documents/generate` → `{ template_id, form_data }`
6. **generateYillikPlanDocx** (DOCX): `yillik_plan_icerik` + `work_calendar` → `haftalar` dizisi; docx paketi ile runtime tablo üretimi
7. R2'ye yükleme → signed URL → indirme

### 2.3 Akış: Diğer Evraklar (Word/Excel merge)

- `requiresMerge=true` şablonlar: `loadTemplateBuffer` → `mergeDocx` / `mergeXlsx` (docxtemplater, SheetJS)
- Placeholder: `{key}`, `{{key}}`; `buildMergeData` user + form_data birleştirir

---

## 3. Web-admin Bileşenleri

### 3.1 Öğretmen Tarafı: `/evrak`

| Bölüm | Açıklama |
|-------|----------|
| Wizard | Sınıf → Bölüm (5–12) → Ders → Öğretim yılı → "Planları Listele" |
| Son ürettikleriniz | localStorage; tek tıkla tekrar üretim |
| Yıllık Plan Şablonları | Sadece `type=yillik_plan`; filtre ile liste |
| Üret modalı | formSchema alanları, evrak_defaults otomatik; önizleme (ilk 5 hafta tablo) |

**Erişim:** Teacher, superadmin, moderator (document_templates modülü)

### 3.2 Admin Tarafı: `/document-templates`

| Sekme | Açıklama |
|-------|----------|
| Şablonlar | CRUD, filtre; file_url, file_url_local, form_schema |
| Ayarlar | Ders kataloğu (subject) CRUD; sadece superadmin |

---

## 4. Veri Kaynakları

| Kaynak | Kullanım |
|--------|----------|
| `document_templates` | Şablon meta (type, grade, section, subject_code, formSchema, fileUrl) |
| `document_catalog` | Ders listesi (grade, section_filter), evrak türleri |
| `yillik_plan_icerik` | Haftalık plan satırları (ünite, konu, kazanımlar vb.) |
| `work_calendar` | Tatil haftaları, ay/hafta etiketleri |
| `User.evrak_defaults` | Okul adı, müdür, zümre, öğretim yılı (Profil/Ayarlar) |
| `School` | name, principal_name |

---

## 5. İyileştirme / Geliştirme Noktaları

### 5.1 Kısa Vadede

- **Çoklu yıllık plan şablonu:** Şu an Coğrafya tek şablon; Matematik, Tarih vb. için yeni şablonlar eklenebilir
- **Evrak türü genişletme:** `yillik_plan` dışında `gunluk_plan`, `zumre`, `dilekce` vb. için wizard ve üretim
- **Excel yıllık plan:** Şu an DOCX runtime üretimi var; XLSX merge (yillik_plan_icerik → sheet) Docxtemplater XLSX ile mümkün (ücretli)

### 5.2 Orta Vadede

- **Tek master şablon:** Tüm dersler için tek XLSX/DOCX şablon + dinamik sütun/genişlik
- **GPT taslak:** Yıllık plan içeriği boşsa GPT ile taslak oluşturma (yillik-plan-icerik modülünde mevcut)
- **Önizleme iyileştirme:** DOCX için tam sayfa önizleme (şu an ilk 5 hafta tablo)

### 5.3 Dokümantasyon

- `EVRAK_URETIM_YOLU.md` – statik vs dinamik üretim
- `EVRAK_ENTEGRASYON_ANALIZ.md` – ÖğretmenEvrak karşılaştırması
- `EVRAK_CALISMA_TAKVIMI_COZUM.md` – takvim entegrasyonu
- `EVRAK_ORNEK_ICERIK.md` – örnek merge verisi

---

## 6. Test için Örnek Akış

1. `docker start ogretmenpro-db`
2. Backend: `cd backend; npm run start:dev`
3. Web-admin: `cd web-admin; npm run dev`
4. Teacher ile giriş → "Yıllık Plan İste" → 9. Sınıf → Ders → Coğrafya → 2024-2025 → Planları Listele
5. Şablon görünüyorsa "Plan İste" → form doldur → Üret ve İndir

**Ön koşul:** Superadmin `yillik_plan_icerik` ve `work_calendar` verisi girmiş olmalı; yoksa plan boş veya hata verebilir.

---

## 7. API Özeti

| Endpoint | Method | Rol | Açıklama |
|----------|--------|-----|----------|
| `/document-templates` | GET | teacher, superadmin, moderator | Filtrelenmiş şablon listesi |
| `/document-templates/subjects` | GET | teacher+ | Ders listesi (grade, section) |
| `/document-templates/options` | GET | teacher+ | academic_years, sections |
| `/document-templates/:id/download` | GET | teacher+ | Statik indirme (signed URL) |
| `/documents/generate` | POST | teacher+ | Form + merge ile üretim |
| `/documents/preview` | POST | teacher+ | Önizleme (xlsx: tablo; docx: ilk 5 hafta) |
