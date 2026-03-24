# Sınav Görevi Sync – Sağlıklı Çalışma İyileştirmeleri

**Kaynaklar (tüm kategoriler):** `add-exam-duty-sources-all-categories.sql` – MEB Personel (RSS) + Güncel Eğitim (agregatör, detect_category_per_item ile meb/osym/aof/ataaof/auzef).

**Tarih:** 2026-03

---

## Uygulanan İyileştirmeler

### 1. URL (externalId) Normalizasyonu

Aynı haber farklı URL varyasyonlarıyla gelebilir:
- `.../haber/x-123.html` vs `.../haber/x-123.html/` (trailing slash)
- `.../haber/x-123.html?utm_source=twitter` vs aynı link utm'siz

`normalizeExternalId()` ile:
- Trailing slash kaldırılır
- `utm_*`, `fbclid` gibi takip parametreleri temizlenir
- Böylece duplicate kayıt önlenir

### 2. Batch Exists Check (Performans)

Önce: Her yeni aday için `findOne({ sourceKey, externalId })` → N sorgu  
Sonra: Kaynak başına 1 sorgu ile tüm `externalId`'ler Set'e alınır, bellek üzerinden O(1) kontrol

Özellikle scrape'da 15+ item olduğunda DB yükü azalır.

### 3. Fetch Retry (Ağ Dayanıklılığı)

Geçici ağ hataları veya kaynak sunucu 5xx hatalarında:
- En fazla 2 yeniden deneme (toplam 3 deneme)
- 800ms, 1600ms bekleme ile exponential backoff
- Başarısız olursa sync kaynağı hata ile işaretlenir, diğer kaynaklar çalışmaya devam eder

### 4. GPT Rate Limit (API Throttle Önleme)

Scrape'da GPT açıkken her item için `extractFromText` çağrılıyor. OpenAI rate limit'e takılmamak için:
- Her GPT çağrısından önce 300ms bekleme
- 15 item × 300ms ≈ 4,5 sn ek süre; API hata oranı düşer

### 5. Başlık Uzunluk Sınırı

`exam_duties.title` varchar(512). Çok uzun başlıklar DB hatası verebilir; `.slice(0, 512)` ile kesilir.

### 6. Container Selector Uyarısı

`container_selector` (örn. `#headline`) tanımlı ama sayfada bulunamazsa log'a uyarı yazılır. Site yapısı değiştiğinde hızlı teşhis için.

### 7. skip_title_keywords (Tek Konulu Sayfalar)

`/haberler/sinav-gorevi/` gibi tek konulu listelerde zaten sadece sınav görevi haberleri var. `scrape_config.skip_title_keywords: true` ile `title_keywords` atlanır; tüm başlıklar işlenir. Güncel Eğitim için aktif.

### 8. Scrape'da GPT Filtre Devre Dışı

Scrape listesinde body/summary yok, sadece başlık. Bu durumda GPT `is_application_announcement` kararı güvenilir değil (bağlam yetersiz). Scrape için GPT filtrelemesi devre dışı; sadece kural tabanlı `isLikelyNonApplication` kullanılır. RSS'te summary/body olduğunda GPT filtrelemesi çalışır.

### 9. Skip Neden Debug Logu

`0 eklendi` durumunda log: `keyword=X, mevcut=Y, gpt_no=Z, kural_no=W` ile hangi aşamada elendiği görülebilir.

### 10. fetch_article_for_dates – Tarih ve Başvuru URL Çıkarma

Scrape listesinde sadece başlık var; tarihler ve başvuru linki haber detayında. `scrape_config.fetch_article_for_dates: true` ile her aday için detay sayfası çekilir:

- **article_body_selector:** İçerik seçicisi (varsayılan: `article, .post-content, .content, main, .haber-detay`)
- **parseDatesFromText:** "Son başvuru: 15.03.2025", "Sınav Tarihi: 06.12.2025" vb. bağlama duyarlı regex
- **extractApplicationUrl:** gis.osym.gov.tr, mebbis, augis.anadolu.edu.tr vb.
- **GPT:** Body varsa çağrılır; tarih yılı 2024–2030 aralığında değilse kural tabanlı sonuç kullanılır

### 11. Sınav Tarihi Öncesi/Sonrası – İlk/Son Oturum (2026-03)

- **Zaman dilimi:** Tüm tarih karşılaştırmaları `Europe/Istanbul` (Türkiye) üzerinden yapılır; UTC sapması giderildi.
- **Sınav öncesi hatırlatma:** İlk sınav oturumundan (exam_date) **1 gün önce** gönderilir.
- **Sınav sonrası hatırlatma:** Son sınav oturumundan (exam_date_end) **1 gün sonra** gönderilir.

Örnek: 27–28 Aralık sınavı → 26'da "yarın sınav"; 29'da "sınav tamamlandı".

### 12. Başvuru Onay Son Gün (application_approval_end) Varsayılanı

Başvuru Onay Son Gün metinde açıkça geçmiyorsa **son başvuru tarihinden +1 gün** olarak türetilir.

### 13. Tarih Parse Düzeltmeleri – Sınav/Sonuç Karışması (2026-03)

- **parseDatesFromText:** Sadece "sınav" bağlamındaki tarihler exam_date/exam_date_end'e alınır; "sonuç 19 Ocak" gibi ifadeler artık sınav tarihine karışmaz (sınav...tarih veya tarih...sınav desenleri).
- **exam_date ≤ exam_date_end:** Sync (RSS + scrape) ve GPT sonrası ters ise otomatik swap.
- **Tablo:** İlk Sınav, Son Sınav; Öncesi Hatırlatma = exam_date - 1 (türetilmiş).

### 14. Alan Bazlı Varsayılan Saat (2026-03)

Her tarih alanı için ayrı varsayılan saat ayarlanabilir (Ayarlar → GPT & Ayarlar). Sadece gün seçildiğinde (saat girilmediğinde) uygulanır. Alanlar: Başvuru Açılış, Son Başvuru, Başvuru Onay Son Gün, Sonuç/Sınav öncesi hatırlatma, Sınav Tarihi, Sınav sonrası hatırlatma. app_config: `exam_duty_default_times` (JSON).

### 15. Tarihsiz / Sadece Ücret Haberlerini Atlama – GPT Sıkı Kontrol (2026-03)

- **Sorun:** "e-Sınav haftada 7.500 TL ek gelir", "LGS sınav görevi ücreti ne kadar?" gibi **sınav/başvuru tarihi olmayan** haberler de duyuru olarak ekleniyordu.
- **GPT prompt:** `is_application_announcement` sadece metinde **somut başvuru/sınav tarihi** veya "başvuru açıldı" bilgisi varsa true; "ücretler belli oldu", "ek gelir getiriyor", "haftada X TL" gibi tarihsiz haberler false (Kural 6).
- **Sync:** GPT sonucu "başvuru duyurusu" olsa bile **application_end, exam_date, exam_date_end hepsi null** ise aday **eklenmez**; sebep: "GPT: İçerikte sınav görevi/başvuru tarihi yok (sadece genel bilgi)".
- **Kural tabanlı:** `isLikelyNonApplication` genişletildi: "haftada X TL", "ek gelir getiriyor", "ne kadar?" → başvuru duyurusu değil (GPT kapalıyken de atlanır).

### 16. Güncel Eğitim: Slayt 15 Haber + Silinen Duyuru Restore (2026-03)

- **Kaynak:** [guncelegitim.com/haberler/sinav-gorevi/](https://www.guncelegitim.com/haberler/sinav-gorevi/)
- **Slayt alanı:** Sayfadaki ~15 haber içeren slayt/SONDAKİKA alanı `container_selector: "#headline"` ile taranır. Bu alan sync’in takip ettiği ana bölümdür. Migration: `guncelegitim-slayt-15-haber.sql`. Alternatif: `slider_selector: "#headline"` + `slider_item_limit: 15` (aynı alanı “slider” olarak da tanımlanabilir).
- **Silinen duyuru:** Duyuru silindiğinde (soft-delete) aynı URL slaytta tekrar görünürse sync ile **geri yüklenir** (deleted_at temizlenir, alanlar güncellenir, status draft).
- **Son başvuru / onay:** Her içerikte son başvuru tarihi olmayabilir. Bu durumda **son başvuru** (`application_end`) ve **başvuru onay son gün** (`application_approval_end`) alanları boş kalır; zorunlu değildir. Eklenmesi için en az bir tarih (sınav tarihi veya son başvuru) yeterlidir.
- **Parse kuralı:** `application_end` sadece metinde açıkça "son başvuru", "son istek zamanı" veya "tercih son" geçtiğinde doldurulur; genel tarih fallback'ı ile rastgele tarih atanmaz (böylece listede son başvuru olmayan duyurularda bu alanlar boş/"—" görünür).
- **İçerik gürültüsü:** Haber sayfalarında fotoğraf üstü yazılar ("Duyuru", "Güncel" vb.) sınav bilgisi değildir; tarih çıkarma metin bağlamına göre yapılır (Son başvuru, Sınav tarihi, Oturum zamanı vb.). Gerekirse `article_body_selector` ile sadece ana metin alanı seçilebilir.

---

## Uygulanan İyileştirmeler (2026-03 devamı)

### 17. GPT hata + retry + kullanım logu
- **extractFromText:** 429/5xx'te 1 retry (1,5 sn bekleme); catch'te log; dönüş `{ result, gptError }` (sync gpt_errors sayacı).
- **log_gpt_usage:** app_config `sync_options.log_gpt_usage` ile completion.usage (token) loglanır.

### 18. Geçmiş sınav tarihi atlama
- **skip_past_exam_date:** Sync seçeneklerinde açılırsa, exam_date_end (veya exam_date) bugünden önceyse aday atlanır; sebep: "Sınav tarihi geçmiş".

### 19. total_restored + total_gpt_errors API
- **runSync** cevabında `total_restored`, `total_gpt_errors`; web-admin sync sonrası "X silinen duyuru geri yüklendi" ve GPT hata bilgisi.

### 20. Sync sağlık endpoint
- **GET /admin/exam-duties/sync-health:** last_sync_at, total_created_last_run, total_restored_last_run, total_gpt_errors_last_run, sources (last_synced_at, last_result_*, consecutive_error_count).

### 21. Scrape timeout + recheck sayısı
- **fetch_timeout_ms:** Sync seçeneklerinde 5000–60000 (varsayılan 15000); fetchWithRetry ve fetchArticleBody'de kullanılır.
- **recheck_max_count:** Sync başına silinen duyurulardan en fazla N tanesi recheck listesine eklenir (varsayılan 1, max 10).

### 22. Hata ardışıklığı alarmı
- **consecutive_error_count:** exam_duty_sync_sources tablosunda; kaynak hata verince +1, başarıda 0.
- 3'e ulaşınca tüm superadmin'lere Inbox (`exam_duty.sync_source_error`); sonra sayaç 0.

### 23. external_id unique constraint
- **idx_exam_duties_source_external_unique:** (source_key, external_id) WHERE NOT NULL – DB duplicate engeli. Migration: `add-exam-duty-sync-consecutive-error-and-unique.sql`.

### 24. Sync seçenekleri (app_config + UI)
- **exam_duty_sync_options:** skip_past_exam_date, recheck_max_count, fetch_timeout_ms, log_gpt_usage. Ayarlar → GPT & Ayarlar sekmesinde form alanları.

---

## Önerilen Ek İyileştirmeler (İleride)

| Öneri | Öncelik | Açıklama |
|-------|---------|----------|
| ~~Container boş uyarısı~~ | ✅ Yapıldı | Log'a uyarı eklendi |
| ~~GPT hata + retry~~ | ✅ Yapıldı | 17 |
| ~~Geçmiş sınav tarihi~~ | ✅ Yapıldı | 18 |
| ~~total_restored API~~ | ✅ Yapıldı | 19 |
| ~~Sync sağlık endpoint~~ | ✅ Yapıldı | 20 |
| ~~Scrape timeout / Recheck~~ | ✅ Yapıldı | 21 |
| ~~Hata ardışıklığı alarmı~~ | ✅ Yapıldı | 22 |
| ~~external_id unique~~ | ✅ Yapıldı | 23 |
| ~~GPT kullanım logu~~ | ✅ Yapıldı | 17, 24 |

---

## Test Kontrol Listesi

- [x] Sync çalıştır – yeni kayıtlar ekleniyor mu (run-exam-duty-sync: 14 eklenen)
- [ ] Aynı kaynak 2. sync – duplicate yok mu (skipped artıyor)
- [ ] Farklı URL varyasyonu (utm, slash) – tek kayıt mı
- [ ] Ağ kesintisi simülasyonu – retry sonrası devam ediyor mu
- [ ] GPT açık + 15 item – rate limit hatası yok mu
- [ ] Çok uzun başlık – DB hatası yok mu
