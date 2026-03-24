# Haberler Modülü – Otomatik İçerik Alma Araştırması

Kullanıcı isteği: **İçeriklerin manuel girilmemesi; kaynaklardan otomatik alınması.**

Defterdoldur /topluluk/news ve /haftalik-bulten referans alınarak, MEB GM ve benzeri sitelerden otomatik veri çekme yöntemleri incelendi.

---

## 1. Mevcut Durum

| Bileşen | Durum |
|--------|-------|
| `content_sources.rss_url` | Var, kullanılmıyor |
| `content_sources.scrape_config` | Var (JSONB), kullanılmıyor |
| `content_sources.last_synced_at` | Var |
| `POST /content/admin/sync` | **Stub** – sadece `last_synced_at` güncelliyor, içerik çekmiyor |
| Manuel içerik ekleme | Çalışıyor (admin UI) |

**adminSync() mesajı:** *"RSS/scraping entegrasyonu henüz yok."*

---

## 2. MEB GM Siteleri Analizi

### 2.1 Örnek Kaynaklar (seed'deki gibi)

| Kaynak | Base URL | Yapı |
|--------|----------|------|
| Personel GM | personel.meb.gov.tr | /www/haberler/kategori/1, /www/duyurular/kategori/2 |
| TEGM | tegm.meb.gov.tr | Benzer yapı |
| OGM | ogm.meb.gov.tr | Benzer yapı |
| TTKB | ttkb.meb.gov.tr | Benzer yapı |
| … | … | … |

### 2.2 Önemli Bulgular

1. **Resmi RSS yok:** personel.meb.gov.tr, tegm.meb.gov.tr vb. MEB GM sitelerinde **resmi RSS/Atom feed adresi tespit edilmedi**. Eğitim bakanlığı ve GM siteleri standart RSS sunmuyor.

2. **HTML listeleri var:** Siteler haber/duyuru listelerini HTML olarak sunuyor:
   - Haberler: `{base}/www/haberler/kategori/1`
   - Duyurular: `{base}/www/duyurular/kategori/2`
   - Öğe URL formatı: `{base}/www/{slug}/icerik/{id}` veya `/icerik/{id}`

3. **Ortak mimari:** MEB GM siteleri benzer PHP tabanlı yapı kullanıyor; sayfa yapısı kaynaktan kaynağa küçük farklılıklar gösterebilir.

---

## 3. Otomatik İçerik Alma Yöntemleri

### 3.1 RSS / Atom

**Ne zaman kullanılır:** Kaynakta `rss_url` tanımlı ve geçerli bir RSS/Atom URL’i varsa.

**Avantajlar:** Standart format, parse kolay, mevcut `tv-public.controller` içinde XMLParser kullanımı var.  
**Dezavantaj:** MEB GM siteleri resmi RSS sunmuyor; sadece RSS sunan (ör. TRT Haber, bakanlık RSS’i vb.) kaynaklar için geçerli.

**Projedeki mevcut örnek:** `tv-public.controller.ts` – `getRssFeed()`, `getQuoteFeed()` – `fast-xml-parser` ile RSS parse ediyor.

### 3.2 Web Scraping (HTML Parse)

**Ne zaman kullanılır:** RSS yoksa ve içerik HTML listelerde sunuluyorsa (MEB GM senaryosu).

**Akış:**
1. Liste sayfasından HTML al (örn. `/www/haberler/kategori/1`)
2. HTML parse et (Cheerio veya benzeri)
3. Başlık, link, tarih alanlarını CSS/XPath ile çıkar
4. Tekrarları önlemek için `source_url` (veya `source_id` + `source_url`) ile DB’de kontrol et
5. Yeni kayıtları `content_items` tablosuna ekle

**scrape_config örneği:**
```json
{
  "list_urls": ["/www/haberler/kategori/1", "/www/duyurular/kategori/2"],
  "item_selector": ".haber-item, .duyuru-item, article, .list-group-item",
  "title_selector": "h4, h5, .title, a",
  "link_selector": "a[href*='/icerik/']",
  "date_selector": ".date, time, .tarih",
  "content_type_map": { "/haberler/": "news", "/duyurular/": "announcement" }
}
```

**Zorluklar:**
- Site yapısı değişirse selector’lar güncellenmeli
- Bazı sayfalar JavaScript ile render edilebilir (Puppeteer gerekebilir)
- Robot/rate limit, politika, yasal uyum (resmi sitelerde dikkatli kullanım)

### 3.3 Üçüncü Taraf API / RSS Agregatörler

**Örnek:** `duyurular-api` (GitHub) – GİB, SGK, TÜRMOB için scraper + JSON + RSS üretiyor.  
**MEB için:** Benzeri açık kaynak MEB duyuru API’si bulunamadı.

**Alternatif:** TRT Haber, MEB merkez (meb.gov.tr) vb. RSS sunan kaynaklara `rss_url` ile bağlanmak.

---

## 4. Önerilen Teknik Çözüm

### 4.1 ContentSyncService

```text
backend/src/content/
├── content-sync.service.ts   # RSS + Scrape mantığı
├── syncers/
│   ├── rss-syncer.ts         # RSS parse (fast-xml-parser)
│   └── scrape-syncer.ts     # HTML parse (cheerio)
```

**Genel akış:**
1. Aktif kaynakları al
2. Her kaynak için:
   - `rss_url` varsa → RSS syncer
   - `scrape_config` varsa → Scrape syncer
3. Parse edilen öğeleri `content_items`’a ekle (source_url benzersiz, tekrar ekleme yok)
4. `last_synced_at` güncelle

### 4.2 Bağımlılıklar

| Paket | Amaç |
|-------|------|
| fast-xml-parser | Zaten var – RSS/Atom parse |
| cheerio | HTML parse (jQuery benzeri API) |

```bash
npm install cheerio
```

### 4.3 Cron Job (Opsiyonel)

`@nestjs/schedule` ile periyodik sync:

```typescript
@Cron(CronExpression.EVERY_HOUR) // veya sync_interval_minutes'a göre
async scheduledSync() { ... }
```

Veya sadece `POST /content/admin/sync` ile tetiklenen manuel sync.

---

## 5. MEB GM İçin Örnek scrape_config

Her GM sitesi için `base_url` + `list_urls` pattern’i kullanılabilir. Önce bir GM sitesi (örn. personel) üzerinde test edilip selector’lar doğrulanmalı.

```json
{
  "list_urls": [
    { "path": "/www/haberler/kategori/1", "content_type": "news" },
    { "path": "/www/duyurular/kategori/2", "content_type": "announcement" }
  ],
  "item_selector": "[data-icerik], .haber-liste li, .duyuru-liste li, article",
  "link_attr": "href",
  "title_from_link": true,
  "base_url_override": null
}
```

Not: Gerçek selector’lar, ilgili sitenin güncel HTML yapısına göre ayarlanmalı; bazı sayfalar JS ile yüklendiği için Puppeteer gerekebilir.

---

## 6. Uygulama Sırası

| Adım | İş | Öncelik |
|------|----|---------|
| 1 | `ContentSyncService` + RSS syncer (rss_url varsa) | Yüksek |
| 2 | Cheerio ekle, scrape syncer temel iskelet | Yüksek |
| 3 | Bir MEB GM kaynağı için scrape_config test | Orta |
| 4 | adminSync() içinde sync servisini çağır | Yüksek |
| 5 | Cron ile periyodik sync (opsiyonel) | Düşük |
| 6 | İçerik Ekle modalını “sadece manuel” modda bırak veya “sync sonrası düzenleme” olarak konumlandır | — |

---

## 7. Uygulama (Tamamlandı)

- **ContentSyncService:** `backend/src/content/content-sync.service.ts` – RSS ve scrape sync
- **RSS:** `rss_url` tanımlı kaynaklardan `fast-xml-parser` ile içerik çekilir. Çalışan demo: BBC Türkçe (`https://feeds.bbci.co.uk/turkce/rss.xml`)
- **Scrape:** `base_url` + `scrape_config.list_urls` tanımlı kaynaklardan Cheerio ile HTML parse
- **MEB GM siteleri:** personel.meb.gov.tr, yegitek.meb.gov.tr vb. listeleri **JavaScript ile** yüklüyor; ilk HTML'de `/icerik/` linkleri yok. Scrape 0 sonuç döner. Çözüm: Puppeteer veya MEB XHR/API keşfi (gelecekte).
- **adminSync():** Sadece sync edilebilir kaynakları işler (rss_url veya base_url+scrape_config). Yanıt: `{ ok, message, results, total_created }`
- **CLI sync:** `npm run run-content-sync`
- **Superadmin Senkronizasyon:** Kaynak durumu tablosu, son sync sonucu tablosu, Sync butonu

---

## 8. Referanslar

- Proje: `docs/PLAN_HABERLER_MODULU.md` – Defterdoldur analizi
- RSS parse: `backend/src/announcements/tv-public.controller.ts` (getRssFeed, getQuoteFeed)
- Entity: `content_sources.rss_url`, `scrape_config`, `sync_interval_minutes`
- Benzer proje: [duyurular-api](https://github.com/yigites/duyurular-api) (GİB, SGK, TÜRMOB scraper → JSON → RSS)
