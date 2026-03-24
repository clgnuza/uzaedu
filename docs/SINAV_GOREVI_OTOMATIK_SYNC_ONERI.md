# Sınav Görevi Otomatik Sync – Detaylı Öneri

**Tarih:** 2026-03  
**Amaç:** Tüm sınav kategorileri (MEB, ÖSYM, AÖF, ATA-AÖF, AUZEF) için sync'i tam otomatik hale getirmek.

---

## Mevcut Durum

| Özellik | Değer |
|---------|-------|
| **Cron** | Her gün 07:00 UTC (≈10:00 Turkey) |
| **Kaynak türü** | Sadece RSS (MEB Personel GM – genel personel; sınav görevi içeriği az veya belirsiz) |
| **Varsayılan kaynak** | Sadece MEB Personel GM |
| **Tarih çıkarma** | Regex (`parseDatesFromText`) – DD.MM.YYYY formatı |
| **application_url** | Sync ile set edilmiyor |
| **scrape_config** | Entity'de var, kullanılmıyor |

---

## Önerilen Fazlar

### Faz 1: Cron ve Kaynak Genişletme (Düşük risk)

**Hedef:** Sync frekansını artırma.

1. **Cron sıklaştırma**
   - Gün 1 kez → **günde 2–4 kez** (örn. 06:00, 10:00, 14:00, 18:00 UTC)
   - Duplicate kontrolü (source_key + external_id) zaten var → ek kaynak riski yok

2. **Yeni varsayılan RSS kaynakları** (RSS URL’si bulunabilirse)
   - MEB Personel GM – mevcut
   - ÖSYM – duyuru sayfası RSS (varsa) – araştırma gerek
   - AÖF – anadolu.edu.tr duyuru RSS (varsa)
   - ATA-AÖF, AUZEF – benzer kurum RSS’leri

3. **Migration:** Varsayılan kaynaklar seed script veya migration ile eklenir.

**Maliyet:** Yok  
**Süre:** ~0,5 gün

---

### Faz 2: HTML Scrape (Ana ihtiyaç – ÖSYM, AÖF, ATA-AÖF, AUZEF)

**Hedef:** RSS olmayan sitelerden duyuru çekme. **Bu faz zorunlu** – ÖSYM ve açıköğretim kurumları RSS sunmıyor.

- `scrape_config` zaten entity’de: `{ url, selectors: { list, title, link, date, summary } }`
- **Cheerio** veya **Puppeteer** (SPA için) ile HTML parse
- Örnek hedefler:
  - ÖSYM duyuru sayfası
  - AÖF koordinatörlük duyuruları
  - Diğer kurumlar

**Riskler:**
- Site yapısı değişirse selector’lar bozulur
**Maliyet:** Düşük (Cheerio)  
**Süre:** 2–4 gün (kaynak başına selector + test)

---

### Faz 3: GPT ile Tarih/Link Çıkarma (Opsiyonel, kalite odaklı)

**Hedef:** Serbest metinden doğru tarih ve başvuru linki çıkarmak.

**Mevcut sınırlar:**
- `parseDatesFromText`: Sadece `DD.MM.YYYY` / `DD/MM/YYYY` regex
- “Başvurular 15–20 Mart 2026”, “Son başvuru: 25.03.2026”, “Sınav 15 Nisan’da” gibi ifadeleri yakalayamıyor
- `application_url`: Sync hiç set etmiyor; duyuru metninde link olsa bile kullanılmıyor

**GPT kullanım önerisi:**

1. **Yeni servis: `ExamDutyGptService`**
   - Girdi: `{ title, summary, body, sourceUrl }`
   - Çıktı: `{ application_start?, application_end?, application_approval_end?, result_date?, exam_date?, exam_date_end?, application_url? }`

2. **Prompt örneği:**
   ```
   Türkçe sınav duyurusu metninden aşağıdaki tarih ve link bilgilerini çıkar.
   JSON döndür. Bulunamayan alan null olsun.
   - application_start: Başvuru açılış
   - application_end: Son başvuru
   - application_approval_end: Onay son gün
   - result_date: Sonuç / hatırlatma tarihi
   - exam_date: Sınav başlangıç
   - exam_date_end: Sınav bitiş
   - application_url: Başvuru yapılacak URL (MEBBİS, e-devlet vb.)
   ```

3. **Akış:**
   - Sync sırasında her yeni item için (veya sadece `parsed.application_end` boşsa) GPT çağrısı
   - GPT yanıtı `application_*` ve `application_url` alanlarını doldurur
   - Başarısız veya boşsa regex/mevcut mantık devam eder

4. **Maliyet kontrolü:**
   - Sadece yeni kayıtlar için GPT
   - Model: `gpt-4o-mini` (ucuz)
   - Günlük 10–50 yeni kayıt → ~0,01–0,05 USD/gün

5. **Yapılandırma:**
   - Superadmin ayarlarda: “Sync’te GPT kullan” toggle
   - `OPENAI_API_KEY` yoksa veya kapalıysa sadece regex kullanılır

**Maliyet:** Düşük–orta (aylık birkaç dolar)  
**Süre:** 2–3 gün

---

### Faz 4: Opsiyonel Otomatik Yayınlama

**Hedef:** Yüksek güvenilir kaynaklardan gelenleri otomatik yayınlamak.

- `exam_duty_sync_sources` tablosuna `auto_publish BOOLEAN DEFAULT false`
- `auto_publish=true` kaynaklardan gelen kayıtlar `status: 'published'` ile oluşturulur
- Önce sadece MEB Personel GM gibi güvenilir kaynaklarda açılabilir
- Risk: Hatalı/uygunsuz duyuru otomatik yayına çıkabilir → varsayılan `false`

---

## Önerilen Uygulama Sırası

| Sıra | Faz | Özet |
|------|-----|------|
| 1 | Faz 1 | Cron 4x/gün (MEB RSS için daha sık denetim) |
| 2 | **Faz 2** | **HTML scrape – ÖSYM, AÖF, ATA-AÖF (RSS yok, zorunlu)** |
| 3 | Faz 3 | GPT ile tarih/link çıkarma (opsiyonel, kalite) |
| 4 | Faz 4 | Otomatik yayınlama (çok dikkatli) |

---

## Kaynak Araştırma Sonuçları (2026-03 Kontrol)

| Kurum | RSS | Durum |
|-------|-----|-------|
| **MEB Personel GM** | ⚠️ VAR ama | Genel personel RSS – atama, yer değiştirme, görevde yükselme sınavı, sözleşmeli alım vb. **Sınav görevi (gözetmen/salon başkanı) duyuruları nadir veya olmayabilir.** title_keywords ile süzülüyor ama çoğu eşleşme sınav görevi değil. |
| **ÖSYM** | ❌ YOK | Resmi site RSS sunmuyor. Duyurular: https://www.osym.gov.tr/TR,5691/duyurular.html |
| **AÖF** (Anadolu) | ❌ YOK | anadolu.edu.tr/acikogretim/aof-duyurular – RSS yok |
| **ATA-AÖF** | ❌ YOK | ataaof.edu.tr – RSS bulunamadı |
| **AUZEF** | ❌ YOK | İstanbul Üniversitesi – RSS bulunamadı |

**Sonuç:**
- **MEB RSS:** Var ama genel personel duyuruları; sınav görevi (gözetmen) içeriği az veya yok. title_keywords (sınav, gözetmen, görev, başvuru) birçoğunu geçirir ama çoğu istenen türde değil (görevde yükselme, sözleşmeli alım sınavı vb.).
- **ÖSYM, AÖF, ATA-AÖF, AUZEF:** RSS yok. Otomatik sync **HTML scrape** ile yapılmalı.
- **Gerçek sınav görevi kaynağı:** MEB gözetmen duyuruları iller/MEBBİS/ayrı sayfa üzerinden yayınlanıyor olabilir; Personel GM RSS’inde garanti yok. MEB için de özel bir duyuru sayfası scrape edilmeli (araştırma gerek).

### Agregatör kaynak: Güncel Eğitim

[**guncelegitim.com/haberler/sinav-gorevi/**](https://www.guncelegitim.com/haberler/sinav-gorevi/) – MEB, ÖSYM, AÖF, Açık Lise, LGS vb. **tüm sınav görevi haberi tek sayfada** toplanıyor. Tek scrape hedefi olarak kullanılabilir.

**Scrape yapılandırması:** Sayfa SONDAKİKA (sidebar) ve ana sınav görevi listesini birlikte içerir. Sadece sınav görevi listesini çekmek için `container_selector: "#headline"` kullanılır. Migration: `add-exam-duty-guncelegitim-source.sql`.

**Dikkat:** Başlıktan **iyi ayırt etmek lazım:**
- **Kategori (meb/osym/aof/ataaof/auzef):** "ÖSYM'den...", "MEB'den...", "Açık Öğretim...", "LGS..." vb. metinden çıkarılmalı
- **Başvuru duyurusu vs bilgi haberi:** "4 Yeni Sınav Görevi" = duyuru; "Sınav Görevi Ücretleri Zamlandı" = ücret bilgisi (başvuru değil) – hangisi exam_duty kaydı olmalı netleştirilmeli
- **Duplicate:** Aynı resmi duyuru farklı başlıklarla tekrarlanabilir; external_id/link ile çakışma önlenmeli

**Öneri:** Bu sayfa HTML scrape ile çekilir; GPT veya kural tabanlı başlık analizi ile kategori (meb/osym/aof) + duyuru türü (başvuru açıldı vs ücret haberi) ayrımı yapılır.

---

## Teknik Özet

```
[Faz 1] Cron: 0 6,10,14,18 * * *  (günde 4 kez)
[Faz 2] scrape_config → Cheerio/Puppeteer
[Faz 3] ExamDutyGptService.extractFromText() → sync pipeline'a entegre
[Faz 4] sync_source.auto_publish → create duty with status
```

---

## Sonuç

- **Öncelik:** Faz 1 (hemen) + Faz 3 (GPT, kalite ve `application_url` için)
- **Faz 2:** ÖSYM/AÖF/ATA-AÖF/AUZEF için zorunlu (RSS yok)
- **Faz 4:** Düşük öncelik; manuel yayın güvenli

GPT entegrasyonu projede zaten kullanılıyor (yıllık plan, çalışma takvimi, optik). Aynı yapı ile sınav görevi sync için de kullanılabilir.
