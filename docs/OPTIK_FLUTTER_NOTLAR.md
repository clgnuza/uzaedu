# Optik / Açık Uçlu Modül – Flutter Tarafı Notları

Bu doküman, Optik Okuma ve AI ile Açık Uçlu Puanlama modülünün Flutter (mobil) tarafında uygulanması için teknik notları içerir.

---

## Genel Bakış

- **Optik form okuma:** MEB/LGS/YKS benzeri optik formların kamera ile okutulması, işaret tanıma, sonuç analizi.
- **Açık uçlu puanlama:** El yazısı cevapların ROI tabanlı okunması, GPT ile puanlama, rubrik desteği.

---

## API Endpoint'leri

| Endpoint | Method | Rol | Açıklama |
|----------|--------|-----|----------|
| `/optik/status` | GET | teacher | Modül hazır mı? `{ enabled, configured, ready }` |
| `/optik/ocr` | POST | teacher | Görüntüden metin (OpenAI Vision). Body: `image_base64`, `language_hint?` |
| `/optik/grade` | POST | teacher | Tek soru puanlama. Body: `question_id`, `mode`, `max_score`, `key_text`, `student_text`, `ocr_confidence`, `language?` |
| `/optik/grade/batch` | POST | teacher | Toplu puanlama. Body: `{ requests: GradeRequestDto[] }` |

**Not:** Tüm isteklerde `Authorization: Bearer <token>` gereklidir. `school_id` ve `user_id` backend tarafından JWT'den alınır.

---

## Modül Hazırlık Kontrolü

Sınav/optik ekranı açılmadan önce:

1. `GET /optik/status` çağır.
2. `ready: false` ise kullanıcıya “Optik modülü şu an kullanılamıyor” mesajı göster, modül ekranına girişi engelle.
3. `enabled: false` → Modül kapatılmış.
4. `configured: false` → OpenAI API anahtarı tanımlı değil (superadmin ayarlardan yapılandırılmalı).

---

## Optik Form Özellikleri

- **Form şablonları:** `GET /optik/form-templates` (teacher, school_admin). Aktif şablonlar listelenir.
- **PDF indirme:** `GET /optik/form-templates/:id/pdf` — `?prepend_blank=1` ile önce boş sayfa eklenir (yazılı sorular için; öğretmen yazılı kağıdının altına form ekleyebilir).
- **Şablon tipleri:** `multiple_choice`, `open_ended`.
- **OMR kimlik alanları:** Form üzerinde Flutter/okuyucu ile okunabilir alanlar (sadeleştirilmiş):
  - **Öğrenci No** — 6 hane (0–9), her sütun bir hane
  - **Kitapçık** — A / B
  - **Sınıf** — 4, 5, 6, 7, 8, 9, 10, 11, 12 (tek seçim)

- **Öğrenci eşleştirme (planlanan):** OMR ile okunan `student_no`, `class` değerleriyle backend üzerinden öğrenci arama. Endpoint: `GET /optik/students/search?school_id=...&student_no=...` (sınıf/öğrenci modülü eklendiğinde).

- **Kamera okuma:** Form görüntüsü al → base64 encode → `POST /optik/ocr` (açık uçlu metin için). Optik işaret okuma (bubble tanıma) için yerel/backend OMR gerekli.
- **Manuel düzeltme:** OCR sonucu düşük güvende (`needs_rescan: true`) ise öğretmene düzeltme ekranı sun.
- **Export:** PDF/Excel ile sonuç dışa aktarımı.

---

## Açık Uçlu Puanlama Özellikleri (Planlanan)

- **ROI tabanlı okuma:** Soru cevap alanı (ROI) kırpılmış görüntü → `POST /optik/ocr` → `student_text` alınır.
- **Kalite kontrolü:** `confidence < threshold` ise `needs_rescan`; öğretmene “Yeniden okut” veya manuel giriş öner.
- **Puanlama modları:** `CONTENT`, `LANGUAGE`, `CONTENT_LANGUAGE`, `MATH_FINAL`, `MATH_STEPS`.
- **Batch grade:** Çoklu soru için `POST /optik/grade/batch`; sırayla veya paralel istek (rate limit dikkate alınmalı).
- **Sonuç raporu:** Her soru için `score`, `max_score`, `confidence`, `needs_rescan`, `reasons` (kriter bazlı puan gerekçesi).

---

## Ortak Özellikler

- **Sınıf / Öğrenci yönetimi:** Sınav tanımı sınıf ve öğrenci listesine bağlı.
- **Sınav geçmişi:** Daha önce okutulan sınavlar, sonuç özeti.

---

## Veri Modelleri (Özet)

### OcrRequestDto
```json
{
  "image_base64": "data:image/jpeg;base64,... veya sadece base64 string",
  "language_hint": "tr" | "en"
}
```

### OcrResponseDto
```json
{
  "text": "Öğrenci cevabı metni",
  "confidence": 0.95,
  "needs_rescan": false
}
```

### GradeRequestDto
```json
{
  "question_id": "soru-1",
  "mode": "CONTENT",
  "max_score": 10,
  "key_text": "Beklenen cevap anahtarı",
  "student_text": "Öğrenci el yazısından OCR ile çıkarılan metin",
  "ocr_confidence": 0.9,
  "language": "tr",
  "subject": "matematik"
}
```

### GradeResultDto
```json
{
  "question_id": "soru-1",
  "mode": "CONTENT",
  "score": 8,
  "max_score": 10,
  "confidence": 0.85,
  "needs_rescan": false,
  "reasons": [
    { "criterion": "İçerik doğruluğu", "points": 6, "evidence": ["öğrenci metninden alıntı"] },
    { "criterion": "Eksik bilgi", "points": -2, "evidence": [] }
  ]
}
```

---

## Hata Kodları

| Code | Açıklama |
|------|----------|
| `OPTIK_MODULE_DISABLED` | Modül kapalı. |
| `OPTIK_NOT_CONFIGURED` | OpenAI API anahtarı tanımlı değil. |
| `OCR_FAILED` | OCR işlemi başarısız. |
| `GRADE_FAILED` | Puanlama başarısız. |

---

## Okul Bazlı Modül Aç/Kapa

`schools.enabled_modules` dizisi boş veya `null` ise tüm modüller açık kabul edilir. `optik_okuma` bu listede yoksa ilgili okulda modül kapalıdır. Öğretmen girişinde okul bilgisi JWT’de olduğundan backend otomatik filtreler.

---

## ZipGrade Karşılaştırması – Eklenecek Özellikler

ZipGrade piyasada önde; bizde olmayan özellikler roadmap'e alınacak:

| Özellik | ZipGrade | Bizde | Öncelik |
|---------|----------|-------|---------|
| Çoktan seçmeli işaret okuma | Bubble (A/B/C/D/E) tanıma, anında puanlama | Yok – sadece metin OCR | Yüksek |
| Gerçek zamanlı kamera UX | Viewfinder, 4 köşe hizalama, odak algılama | Flutter kamera planlı | Yüksek |
| Offline tarama | İnternet yokken tarama | Backend API zorunlu | Orta |
| Grade book | Öğrenci/ders/sınav not defteri | Planlı | Orta |
| Item analysis | Madde analizi, zorluk, ayırıcılık | Yok | Orta |
| Öğrenci portalı | Sonuçları öğrenciye gösterme | Yok | Düşük |
| Standards tagging | Kazanım etiketleme | outcome_sets var, entegrasyon yok | Orta |
| Hazır form PDF/Word | 20/50/100 soruluk indirilebilir | Form şablonları var, çıktı belirsiz | Orta |
| True/false, eşleştirme, grid | Çoklu soru tipi | Sadece çoktan seçmeli + açık uçlu | Düşük |

**Bizde güçlü, ZipGrade’ta yok:** Açık uçlu AI puanlama, rubrik, kısmi puan, okul bazlı modül kontrolü, superadmin paneli.

---

## OMR Form Layout (Varsayılan – A4)

Form PDF’te kimlik alanları **sağ üst** bölümdedir (x ≈ 320 pt). Sayfa koordinatları PDF noktası (1 pt = 1/72 inç):

| Alan        | Tip     | Sütun/Hane | Pozisyon (yaklaşık)          |
|-------------|---------|------------|------------------------------|
| Öğrenci No  | 0–9     | 6 hane     | x=320, y≈795, colSpacing=18, rowSpacing=7 |
| Okul Kodu   | 0–9     | 4 hane     | x=320, y≈720, colSpacing=18, rowSpacing=7 |
| Kitapçık    | A/B     | 2 seçenek  | x=320/340, y≈645            |
| Ad Soyad    | A–Z     | 8 karakter | x=320, y≈620, colSpacing=12, rowSpacing=4.5 |

Flutter tarafında OMR: Form köşelerini tespit edip perspektif düzeltmesi yapın; sonra bu koordinatlarla bubble doluluk oranını hesaplayın. `roi_config` (şablonda) ileride koordinat override için kullanılabilir.

---

## Bikom/OMR .fmt Format Referansi (Ortaokul)

Bikom optik okuyucu format dosyalari (`.fmt`) alan tanimlarini icerir. Ornek yapi:

| Alan | Satir/Kolon Araligi | Secenekler | Aciklama |
|------|---------------------|------------|----------|
| AD-SOYAD | 01-29, 02-21 | A-Z | Ad soyad (harf grid) |
| OKUL KODU | 07-16, 23-28 | 0-9 | Okul kodu (rakam grid) |
| OGRENCI NO | 07-16, 33-38 | 0-9 | Ogrenci numarasi (6 hane) |
| T.C. | 20-29, 23-33 | 0-9 | TC kimlik no |
| SINIF | 07-11, 41-41 | 4-5-6-7-8 | Sinif (ortaokul) |
| SUBE | 07-35, 42-42 | A-Z | Sube harfi |
| CINSIYET | 23-23, 36-39 | E/K | Erkek/Kadin |
| KIT | 20-20, 36-39 | A/B/C/D | Kitapcik turu |
| TURKCE, INKILAP, DIN, vb. | 33-52, cesitli satirlar | A/B/C/D | Ders cevap bloklari |

Format: `col_bas=col_son=row_bas=row_son=Yon=D/K=Secenekler=X=Etiket` (tahmini). H/K: Yatay/Dikey, D/K: format varyanti. Karakter seti bazen farkli encoding (Cyrillic benzeri) kullanir.

**Bizim formla uyum:** OgretmenPro formu daha basit (Okul Kodu 4 hane, Kitapcik A/B, Ad Soyad 10 sutun). Bikom uyumlu okutma icin ileride `roi_config` ile koordinat eslemesi yapilabilir.

---

## Referanslar

- Backend: `backend/src/optik/`
- PDF üretimi: `optik-form-pdf.service.ts`
- API sözleşmesi: `API_CONTRACT.md`
- Superadmin ayarlar: `/optik-okuma-ayarlar` (web-admin)
