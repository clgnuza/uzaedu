# Evrak ve Planlar Modülü – Detaylı Analiz ve Öneri

**Kaynak:** [ÖğretmenEvrak](https://ogretmenevrak.com/) incelenmesi, MEB Maarif Modeli, CORE_ENTITIES, MODULE_RULES.

---

## 1. ÖğretmenEvrak Planlar Yapısı – Analiz

### 1.1 Genel Hiyerarşi

Planlar bölümü **üç seviyeli** filtre yapısı kullanıyor:

```
Plan Türü (yillik_plan | gunluk_plan | egzersiz | iyep | bep)
    └── Sınıf (1–12)
        └── Bölüm (Ders | Seçmeli | İHO) — ortaokul/lise için
            └── Ders/Branş
```

### 1.2 Yıllık Plan (yillik_plan)

| Seviye | Öğe | Örnek Değerler |
|--------|-----|----------------|
| 1 | Sınıf | 1, 2, 3, …, 12 |
| 2 | Bölüm | Ders, Seçmeli, İHO (İmam Hatip Ortaokulu) |
| 3 | Ders | Türkçe - Maarif M., Matematik - Maarif M., Fen Bilimleri, Rehberlik vb. |

**1. sınıf dersleri (sadece Ders):**
- Türkçe - Maarif M., Serbest Etkinlik, Rehberlik, Müzik - Maarif M., Matematik - Maarif M., Hayat Bilgisi - Maarif M., Görsel Sanatlar Maarif M., Beden Eğitimi ve Oyun - Maarif M.

**5. sınıf dersleri (Ders + Seçmeli + İHO):**
- Türkçe, Sosyal Bilgiler, Rehberlik, Müzik, Matematik, İngilizce, Görsel Sanatlar, Fen Bilimleri, Din Kültürü ve Ahlak Bilgisi, Bil. Tek. ve Yazılım, Beden Eğitimi ve Spor, Almanca (seçmeli), vb.

**Format:** MEB Maarif Modeli’ne uygun; Word (.docx) / Excel (.xlsx). İndirme için giriş zorunlu.

### 1.3 Günlük Plan (gunluk_plan)

| Seviye | Öğe | Not |
|--------|-----|-----|
| 1 | Sınıf | 1–12 |
| 2 | Bölüm | Ders, Seçmeli, İHO |
| 3 | Ders | Sınıfa göre değişir |

**Özellik:** “Hazır dersler” – haftalık/günlük hazır planlar.

**Format:** Word (.docx), MEB Maarif Modeli, haftalık paketler (örn. 1. Hafta, 2. Hafta).

### 1.4 Egzersiz Planları (egzersiz)

- Öğrenci kulüpleri, sosyal etkinlikler, sportif faaliyetler.
- Yıllık/egzersiz dönemi bazlı.
- Format: Word/Excel.

### 1.5 İYEP Planları (iyep)

**İYEP** = İlköğretimde Yetiştirme Programı (temel kazanımlarda eksik öğrenciler).

| Alt tür | Açıklama |
|---------|----------|
| Türkçe | Türkçe modül planları |
| Matematik | Matematik modül planları |

**Özellikler:**
- Okul onayı → ilçe, dosya seti
- Modül bazlı (öğrenci tekrar, modül tamamlama tutanakları)
- Haftalık 1–2 saat formatı

### 1.6 BEP Planları (bep)

**BEP** = Bireyselleştirilmiş Eğitim Planı (RAM raporu, üstün zeka vb.).

| Alt tür | Açıklama |
|---------|----------|
| Bep Dosyası (Yeni) | Güncel format |
| Bep Planı (Yeni) | Güncel plan şablonu |
| Bep Planı (Eski) | Eski format |
| Bep Kaba Formları | Değerlendirme ölçeği, kaba değerlendirme |

**Süreç:** Kaba değerlendirme → BEP planı → dönemlik/yıllık uygulama.

---

## 2. MEB Formatları ve Güncellik

| Plan Türü | Resmi Format | Güncel Model |
|-----------|--------------|--------------|
| Yıllık | Excel çerçeve plan | Maarif Modeli (2024–2025) |
| Günlük | Word, haftalık paket | Maarif Modeli |
| BEP | Word/Excel, MEB kılavuz | Yeni BEP formatı |
| İYEP | Modül, tutanak, okul evrakları | Güncel modül yapısı |

**Kaynak:** MEB TEGM çerçeve planları, [tegm.meb.gov.tr](https://tegm.meb.gov.tr).

---

## 3. ÖğretmenPro Mevcut Yapı

### 3.1 DocumentTemplate (CORE_ENTITIES)

```ts
// Mevcut
type: zumre | gunluk_plan | yillik_plan
version, file_url, is_active, created_at
```

- Sadece 3 evrak türü
- Sınıf/ders/bölüm bilgisi yok
- Sürümleme var

### 3.2 OutcomeSet (Kazanım Cebimde)

```ts
subject, grade, items  // Branş + sınıf
```

- Kazanım setleri `subject` + `grade` ile tanımlı
- Evrak şablonlarıyla doğrudan ilişkili değil

### 3.3 Classes-Subjects

- `SchoolClass`: name, grade (1–12), section
- `SchoolSubject`: name, code (okul bazlı)
- Teacher: `teacher_subject_ids` (branş)

---

## 4. ÖğretmenPro Evrak Modülü Önerisi

### 4.1 Evrak Türü Genişletmesi

```ts
// DocumentTemplate.type genişletmesi
type DocumentTemplateType =
  | 'yillik_plan'
  | 'gunluk_plan'
  | 'egzersiz_plan'
  | 'iyep_plan'       // sub_type: turkce | matematik
  | 'bep_plan'        // sub_type: dosya | plan_yeni | plan_eski | kaba_form
  | 'zumre'
  | 'kulup_evrak'
  | 'veli_toplanti_tutanak'
  | 'aday_ogretmen_dosyasi'
  | 'rehberlik_raporu'
  | 'diger';
```

**MVP için öncelik sırası:**
1. `yillik_plan`, `gunluk_plan`, `zumre` (mevcut)
2. `egzersiz_plan`, `iyep_plan`, `bep_plan`
3. `kulup_evrak`, `veli_toplanti_tutanak`, `aday_ogretmen_dosyasi`, `rehberlik_raporu`

### 4.2 DocumentTemplate Entity Genişletmesi

```ts
@Entity('document_templates')
class DocumentTemplate {
  id: string;
  type: DocumentTemplateType;
  subType?: string | null;        // iyep: turkce|matematik, bep: dosya|plan_yeni|plan_eski|kaba_form
  grade?: number | null;          // 1-12, null = tüm sınıflar
  section?: string | null;        // ders|secmeli|iho
  subjectCode?: string | null;    // turkce, matematik, fen_bilimleri vb. (MEB kodları)
  subjectLabel?: string | null;   // "Türkçe - Maarif M."
  curriculumModel?: string | null; // maarif_m | eski (ileride)
  version: string;
  fileUrl: string;
  fileFormat: 'docx' | 'xlsx' | 'pdf';
  isActive: boolean;
  academicYear?: string | null;   // "2024-2025"
  createdAt: Date;
}
```

### 4.3 Filtre Parametreleri (API)

```
GET /document-templates
  ?type=yillik_plan
  &grade=5
  &section=ders
  &subject_code=turkce
  &academic_year=2024-2025
  &active_only=true
```

**Teacher response örneği:**
```json
{
  "items": [
    {
      "id": "uuid",
      "type": "yillik_plan",
      "grade": 5,
      "section": "ders",
      "subject_label": "Türkçe - Maarif M.",
      "version": "2024-1",
      "file_url": "https://...",
      "file_format": "docx",
      "academic_year": "2024-2025"
    }
  ]
}
```

### 4.4 UI Akışı (Teacher – Flutter / Web)

**Seçim sırası (planlar için):**
1. Plan türü (Yıllık Plan, Günlük Plan, Egzersiz, İYEP, BEP)
2. Sınıf (1–12)
3. Bölüm (Ders / Seçmeli / İHO) — ortaokul/lise
4. Ders (sınıfa göre dinamik liste)
5. Öğretim yılı (2024–2025 vb.)
6. Profil otomatik doldurma → Önizleme → PDF/Word indirme

**Zümre / diğer evraklar:** Sadece tür seçimi + form; sınıf/ders opsiyonel.

### 4.5 Ders/Branş Kataloğu

**Öneri:** MEB ders kodları + sınıf eşlemesi config veya tablo.

| Sınıf | Dersler (örnek) |
|-------|-----------------|
| 1 | Türkçe, Matematik, Hayat Bilgisi, Müzik, Görsel Sanatlar, Beden Eğitimi ve Oyun, Serbest Etkinlik, Rehberlik |
| 5 | Türkçe, Matematik, Fen Bilimleri, Sosyal Bilgiler, İngilizce, Din Kültürü, Müzik, Görsel Sanatlar, Beden Eğitimi, Bil. Tek. ve Yazılım, Rehberlik + seçmeliler |
| 9–12 | Lisans branşları |

**Alternatif:** `DocumentTemplate` kayıtlarında `subject_code` + `grade` ile eşleme; config dosyası veya `document_template_subjects` tablosu.

### 4.6 Şablon Üretim Akışı

```
POST /documents/generate
Body: {
  template_id: string,
  form_data: {
    okul_adi?: string,
    sinif?: string,
    ders_adi?: string,
    ogretim_yili?: string,
    hafta?: number,
    // ... şablona özel alanlar
  },
  format: 'docx' | 'pdf'
}
→ Profil (ad, branş, okul) otomatik merge
→ docx-template / puppeteer ile doldurma
→ Response: { download_url } veya stream
```

---

## 5. Uygulama Aşamaları

### Faz 1 (MVP)
- Entity: `DocumentTemplate` (type, grade, section, subjectCode, subjectLabel, version, fileUrl, fileFormat, isActive)
- API: `GET /document-templates` (filtre: type, grade, section, subject_code)
- Admin: Basit CRUD, dosya yükleme (R2)
- Teacher: Tür → Sınıf → Ders seçimi, indirme (hazır dosya veya minimal merge)

### Faz 2
- `POST /documents/generate`: Form verisi + profil merge, PDF/Word üretimi
- MEB ders kataloğu (config veya tablo)
- İYEP, BEP, egzersiz planları

### Faz 3
- `subType`, `academicYear`, müfredat modeli (Maarif vb.)
- Kulüp, veli toplantı, aday öğretmen, rehberlik evrakları
- Entitlement / market entegrasyonu

---

## 6. Özet Tablo

| Özellik | ÖğretmenEvrak | ÖğretmenPro Öneri |
|---------|---------------|-------------------|
| Plan türleri | 5+ (yıllık, günlük, egzersiz, İYEP, BEP) | Faz 1: 3, Faz 2–3: 10+ |
| Sınıf filtre | 1–12 | grade: 1–12 |
| Bölüm | Ders, Seçmeli, İHO | section: ders, secmeli, iho |
| Ders/Branş | Sınıfa göre 8–12 ders | subject_code + subject_label |
| Müfredat | Maarif Modeli | curriculum_model (maarif_m, eski) |
| Öğretim yılı | Implicit | academic_year (2024-2025) |
| İndirme | Giriş sonrası | Auth + entitlement |
| Form doldurma | Sınırlı | Profil otomatik, form_data merge |

---

*Bu analiz EVRAK_PLANLAR_ANALIZ.md olarak projeye eklendi. CORE_ENTITIES, API_CONTRACT ve implementasyon planı bu önerilere göre güncellenebilir.*
