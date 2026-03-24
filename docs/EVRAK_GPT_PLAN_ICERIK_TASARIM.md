# GPT ile Yıllık Plan İçeriği Oluşturma – Tutarlı ve Hatasız Yaklaşım

Tüm dersler veya tek ders için GPT API ile tutarlı, hatasız plan içeriği oluşturma stratejisi.

---

## 1. Ana Sorunlar ve Çözümler

| Sorun | Çözüm |
|-------|-------|
| GPT farklı formatta dönebilir | Structured Outputs (JSON schema) – OpenAI 2024 |
| Dersler arası tutarsızlık | Ders bazlı sistem prompt şablonu + müfredat referansı |
| Yanlış/eksik kazanım | MEB referans + doğrulama kuralları + insan onayı |
| Tatil haftaları karışması | work_calendar context prompt'a eklenir |
| Token limiti (36 hafta tek seferde) | Bloklama: 2 dönem (18+18) veya 4 blok (9+9+9+9) |
| Tüm dersler çok uzun sürer | Ardışık + rate limit; isteğe bağlı paralel |

---

## 2. Teknik Yaklaşım

### 2.1 Structured Outputs (OpenAI)

```javascript
// response_format ile JSON schema zorunlu
{
  response_format: {
    type: "json_schema",
    json_schema: {
      name: "yillik_plan_taslak",
      strict: true,
      schema: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                week_order: { type: "integer", description: "1-36" },
                unite: { type: "string" },
                konu: { type: "string" },
                kazanimlar: { type: "string" },
                ders_saati: { type: "integer" },
                belirli_gun_haftalar: { type: "string" }
              },
              required: ["week_order", "unite", "konu", "kazanimlar", "ders_saati"]
            }
          }
        },
        required: ["items"]
      }
    }
  }
}
```

- **Strict schema:** Model şemaya uymak zorunda; aksi halde hata.
- **Temperature: 0** – Tekrarlanabilir sonuç.

### 2.2 Müfredat Referansı (Context)

GPT'ye verilecek sabit referans:

```
MEB [DERS] [SINIF]. Sınıf Öğretim Programı (güncel).
Ünite yapısı ve kazanım kodları (COĞ.9.1.1, MAT.9.2.3 vb.) kullan.
Türkçe, resmi eğitim terminolojisi.
```

**Kaynak seçenekleri:**
- **A) Statik config:** `backend/src/config/curriculum-refs.ts` – ders/sınıf bazlı kısa özet
- **B) RAG:** MEB PDF’leri vektör DB; ilgili chunk’lar prompt’a eklenir
- **C) Manuel referans:** Superadmin prompt’ta “Ek notlar” alanı

**Minimum (A):** Ders adı + sınıf + ünite listesi (config’ten)

### 2.3 Ders Bazlı Prompt Şablonu

Her ders için ortak yapı, değişen kısımlar parametre:

```
Sen bir MEB [DERS] dersi [SINIF]. sınıf yıllık plan uzmanısın.

KURALLAR:
- 36 haftalık plan; her hafta için unite, konu, kazanımlar, ders_saati üret.
- Kazanım formatı: [DERS_KODU].[SINIF].[ÜNITE].[NO] (örn: COĞ.9.1.1)
- Tatil haftalarında ders_saati=0, konu="[TATIL_ETİKETİ]"
- Ünite geçişleri mantıklı olsun; bir ünite bitmeden diğerine geçme.

MÜFREDAT:
[ÜNİTE_LISTESİ – config veya RAG’den]

ÇALIŞMA TAKVİMİ (tatil haftaları):
[TATIL_HAFTALARI – work_calendar’dan]

Öğretim yılı: [ACADEMIC_YEAR]
```

---

## 3. İş Akışı

### 3.1 Tek ders

```
1. Superadmin: Ders + Sınıf + Yıl seç
2. "GPT ile taslak oluştur" butonu
3. Backend: work_calendar çek → tatil haftaları
4. Backend: curriculum ref (config) çek
5. Backend: Prompt oluştur → GPT API (structured output)
6. Backend: Çıktıyı validate (week_order 1-36, ders_saati 0-10)
7. Response: items[] → UI’da önizleme
8. Superadmin düzenler → "Kaydet" → yillik_plan_icerik’e yaz
```

### 3.2 Tüm dersler

```
1. Superadmin: Sınıf + Yıl seç, "Tüm dersler için taslak oluştur"
2. document_catalog’dan subject listesi (grade filtresi)
3. Her ders için:
   a. Aynı akış (work_calendar + curriculum + prompt)
   b. Rate limit: ders başına ~5 sn bekleme
   c. Hata alırsa: logla, sonraki derse geç
4. Toplu önizleme veya ders ders kaydet
```

**Alternatif:** Arka planda job; tamamlanınca bildirim.

---

## 4. Validasyon Katmanları

### 4.1 API çıktısı

| Kontrol | Aksiyon |
|---------|---------|
| `items` array ve en az 1 eleman | Geçersizse hata |
| Her `week_order` 1–36, unique | Tekrarlar/taşmalar düzelt veya reddet |
| `ders_saati` 0–10 | Taşan değerleri 2’ye sınırla |
| Tatil haftasında `ders_saati=0` | Zorla düzelt |
| `kazanimlar` boş | Uyarı ver, superadmin doldursun |
| `unite` / `konu` max length | Kes veya truncate |

### 4.2 İnsan onayı

- GPT çıktısı her zaman **taslak**
- Kaydetmeden önce UI’da tablo önizleme
- "Kaydet" ile DB’ye yazılır
- İleride: "Değişiklikleri onayla" (diff göster)

---

## 5. Müfredat Config Örneği

```typescript
// backend/src/config/curriculum-unites.ts
export const CURRICULUM_UNITES: Record<string, Record<number, string[]>> = {
  cografya: {
    9: [
      "1. Ünite: Coğrafyanın Doğası ve Tarihsel Gelişimi",
      "2. Ünite: Mekânsal Bilgi Teknolojileri",
      "3. Ünite: Haritalar",
      "4. Ünite: Yerşekilleri",
      // ...
    ],
  },
  matematik: {
    9: ["1. Ünite: Mantık", "2. Ünite: Kümeler", /* ... */],
  },
  // ...
};
```

Eksik dersler için: GPT’den “ünite listesi oluştur” ayrı bir çağrı veya config’e manuel ekleme.

---

## 6. API Tasarımı

### 6.1 Tek ders taslak

```
POST /yillik-plan-icerik/generate-draft
Body: {
  subject_code: string,
  subject_label: string,
  grade: number,
  section?: string,
  academic_year: string,
  options?: { include_tatil_rows?: boolean }
}
Response: {
  items: [{ week_order, unite, konu, kazanimlar, ders_saati, belirli_gun_haftalar?, ... }],
  warnings?: string[],
  token_usage?: { input: number, output: number }
}
```

### 6.2 Tüm dersler taslak

```
POST /yillik-plan-icerik/generate-draft-bulk
Body: {
  grade: number,
  academic_year: string,
  subject_codes?: string[]  // boşsa tüm dersler
}
Response: {
  results: [
    { subject_code, subject_label, items: [...], warnings?: string[], error?: string }
  ]
}
```

- Timeout: 60–120 sn
- Streaming veya polling ile ilerleme gösterilebilir

---

## 7. Hata Yönetimi

| Hata | Davranış |
|------|----------|
| OpenAI API hata | Retry 1 kez; sonra kullanıcıya "Tekrar dene" |
| Schema uyumsuzluğu | Structured Outputs kullanıldığında nadir; log + hata |
| Rate limit (429) | Exponential backoff; kullanıcıya "İşlem uzadı" |
| work_calendar boş | "Önce çalışma takvimini doldurun" uyarısı |
| Curriculum ref eksik | Varsayılan prompt; uyarı: "Müfredat referansı eksik" |

---

## 8. Maliyet ve Performans

- **Tek ders:** ~2–4K token giriş, ~3–6K çıkış → ~0,01–0,03 USD (GPT-4o-mini)
- **Tüm dersler (20 ders):** ~0,2–0,6 USD
- **Öneri:** GPT-4o-mini (ucuz, yeterli); kalite kritikse GPT-4o

---

## 9. Uygulama Sırası

| # | Adım | Açıklama |
|---|------|----------|
| 1 | Curriculum config | `curriculum-unites.ts` – en az 2–3 ders için |
| 2 | GPT service | `YillikPlanGptService` – prompt builder + OpenAI call |
| 3 | Structured schema | JSON schema tanımı |
| 4 | `generate-draft` endpoint | Tek ders |
| 5 | UI: Taslak önizleme + Kaydet | |
| 6 | Validasyon | week_order, ders_saati, tatil |
| 7 | `generate-draft-bulk` (opsiyonel) | Tüm dersler |
| 8 | Rate limit + retry | |

---

## 10. Özet

- **Tutarlılık:** Structured Outputs + temperature=0 + ders bazlı prompt
- **Hatasızlık:** Validasyon + insan onayı + curriculum referansı
- **Tek ders:** 1 istek, 36 hafta (gerekirse bloklara böl)
- **Tüm dersler:** Ders sayısı kadar istek, rate limit ile
- **Müfredat:** Config (ünite listesi) veya RAG ile MEB referansı
- **Tatil uyumu:** work_calendar’dan tatil haftaları prompt’a eklenir
