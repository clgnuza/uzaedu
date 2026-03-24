# Akıllı Tahta Ekranı – Duyuru TV Modülü Kullanımı ve Performans Analizi

## Soru
Tahta ekranı (kilit ekranı, bekleme ekranı) için Duyuru TV modülümüz kullanılabilir mi? Çok sayıda tahta olacağı için kasma, yığılma, yavaşlama riski var mı?

---

## Duyuru TV Mimari Özeti

### Veri Akışı
| Bileşen | Açıklama |
|---------|----------|
| **Endpoint** | `GET /api/tv/announcements/{audience}?school_id=xxx` (public, auth yok) |
| **İlk yükleme** | Sayfa açılınca 1 istek |
| **Polling** | 60 saniyede bir aynı endpoint |
| **localStorage** | Son yanıt cache'lenir; backend yoksa offline gösterim |
| **Ek istekler** | Hava durumu (/tv/weather), RSS (/tv/rss-feed) – per sayfa |

### Ekran Tipleri
- **corridor** – Koridor TV
- **teachers** – Öğretmenler odası TV
- **classroom** – Tahta ekranı (sınıfa özel); `?school_id=XXX&device_id=YYY` ile sınıf bazlı "Şu anki ders" gösterilir
- **audience** sadece duyuru filtrelemesi (tv_audience) için kullanılır

### TV Cihaz Eşleştirme (Opsiyonel)
- POST /tv/pair, POST /tv/heartbeat – admin panelde cihaz listesi için
- TV sayfası şu an **pair/heartbeat kullanmıyor** – sadece school_id + audience ile çalışıyor

---

## Tahta vs TV Sayı Karşılaştırması

| Ortam | Duyuru TV Ekran | Akıllı Tahta |
|-------|-----------------|--------------|
| **Tipik okul** | 2–5 (koridor, öğretmenler, ek koridorlar) | 20–50+ (her sınıfta 1) |
| **Büyük okul** | 5–10 | 50–80+ |
| **Örnek** | 1 koridor + 1 öğretmenler = 2 ekran | 30 sınıf = 30 tahta |

---

## Duyuru TV’yi Tahta Ekranı Olarak Kullanma

### Uyumluluk
- **Evet, kullanılabilir.** TV sayfası zaten public, school_id ile okul verisi alıyor.
- Tahta tarayıcısı `/tv/corridor?school_id=XXX` veya yeni bir audience (`classroom`) açılabilir.

### Gerekli Uyarlamalar
1. **Tahta-bazlı içerik:** Her tahta sınıfa özel "Şu anki ders – Öğretmen" gösterecekse `device_id` veya `pairing_code` parametresi gerekir. Mevcut TV endpoint’i buna göre genişletilmeli.
2. **Yeni audience:** `classroom` veya `smartboard` – tahtalar bu gruptan veri alsın.
3. **Kilit ekranı layout:** Duyuru TV layout’u sadeleştirilerek tahta bekleme ekranı yapılabilir (duyurular + şu anki ders bilgisi).

---

## Performans Analizi – Çok Sayıda Tahta

### API Yükü

| Senaryo | Tahta sayısı | Polling aralığı | İstek/dakika | İstek/saniye |
|---------|--------------|-----------------|--------------|--------------|
| Küçük okul | 20 | 60 sn | 20 | ~0,33 |
| Orta okul | 40 | 60 sn | 40 | ~0,67 |
| Büyük okul | 80 | 60 sn | 80 | ~1,33 |
| Çok büyük | 150 | 60 sn | 150 | ~2,5 |

**Sonuç:** 60 sn polling ile 100 tahtaya kadar saniyede ~1–2 istek. Backend için **yönetilebilir**.

### Spike Riski (Aynı Anda Yükleme)
- Okul genelinde elektrik kesintisi sonrası veya sabah açılışta **tüm tahtalar aynı anda** sayfa açarsa:
  - 30 tahta ≈ 30 paralel `GET /tv/announcements/...` isteği
  - 80 tahta ≈ 80 paralel istek
- **NestJS + PostgreSQL:** Bağlantı havuzu (default ~10) bu spike’ta kuyruğa alır. Yanıt süresi artabilir ama genelde çökmez.
- **Öneri:** İlk yüklemede basit bir **exponential backoff** veya rastgele 0–10 sn gecikme ile tahtaları dağıtmak spike’ı yumuşatır.

### Sunucu Tarafı
- **DB:** `listForTv` duyuru + okul config sorgusu. Index’ler varsa hızlı.
- **CPU:** Sorgu basit; NestJS için düşük yük.
- **Bant genişliği:** JSON yanıtı orta boyutlu (duyurular, okul config). 80 tahta × ~50 KB ≈ 4 MB/dakika – ihmal edilebilir.

### İstemci Tarafı (Her Tahta)
- Her tahta ayrı tarayıcı/sekme – **kendi cihazında** render ediyor.
- Sunucu sadece API yanıtı veriyor; video/görsel işleme tahta cihazında.
- **Tahta donanımı:** Eski/android tabanlı tahtalar yavaş olabilir; bu TV modülünden bağımsız bir donanım konusu.

---

## Olası Darboğazlar ve Önlemler

| Risk | Açıklama | Önlem |
|------|----------|-------|
| **DB bağlantı havuzu** | 80+ paralel istek aynı anda | Pool size artırma; polling aralığını 90–120 sn yapma |
| **Spike** | Sabah açılışta toplu bağlanma | İstemci tarafında rastgele 0–15 sn gecikme ile ilk isteği dağıtma |
| **Cache yok** | Her istek DB’ye gidiyor | `GET /tv/announcements` için Redis/in-memory cache (örn. 30–60 sn TTL) |
| **Tahta-bazlı endpoint** | Her tahta için ayrı "şu anki ders" sorgusu | Tek endpoint’te `device_id` ile ek veri; veya batch endpoint |

---

## Önerilen Yaklaşım

### Seçenek A: Minimal – Mevcut TV Sayfasını Kullan
- Tahta ekranı `/tv/corridor?school_id=XXX` veya `/tv/classroom?school_id=XXX` açar.
- Tüm tahtalar **aynı içeriği** görür (duyurular, program, nöbet).
- **Şu anki ders (sınıfa özel)** gösterilmez.
- **Avantaj:** Ek geliştirme yok, performans riski düşük.
- **Dezavantaj:** Sınıf bazlı "3. Ders – Matematik – Öğr. X" yok.

### Seçenek B: Hibrit – TV + Tahta Bilgisi
- Yeni endpoint: `GET /tv/announcements/classroom?school_id=XXX&device_id=YYY` (veya pairing_code).
- Yanıtta: duyurular (mevcut TV gibi) + ek `current_slot: { lesson_num, subject, teacher_name }`.
- Backend: `device_id` → `smart_board_devices` → `class_section` → `teacher_timetable` (mevcut mantık).
- **Avantaj:** Her tahta kendi sınıfının dersini görür.
- **Dezavantaj:** Her istekte ek DB sorgusu (device + timetable). Cache ile hafifletilebilir.

### Seçenek C: Tam Ayrım
- Tahta ekranı için ayrı sayfa/layout (Duyuru TV’den esinlenerek).
- `/tv/classroom` veya `/smart-board/display?school_id=XXX&pairing_code=YYY`.
- İçerik: duyurular + sınıfa özel ders + belki kilit/kod giriş alanı.

---

## Binlerce Tahta – Yüzlerce Okul Ölçeği

**İleride:** Yüzlerce okul × onlarca tahta = binlerce toplam cihaz.

### Platform Geneli API Yükü (60 sn polling)

| Toplam tahta | Okul sayısı (örnek) | İstek/saniye (sürekli) | Spike (aynı anda açılış) |
|--------------|---------------------|------------------------|--------------------------|
| 1.000 | ~30 | ~17 | 1.000 paralel |
| 5.000 | ~150 | ~83 | 5.000 paralel |
| 10.000 | ~300 | ~167 | 10.000 paralel |

### Bu Ölçekte Zorunlu Önlemler

| Önlem | Açıklama |
|-------|----------|
| **Cache zorunlu** | Duyurular okul bazlı, sık değişmez. Redis/in-memory cache 5–10 dk TTL – DB yükü ciddi azalır. Okul bazlı cache = aynı okuldaki tüm tahtalar ortak yanıt. |
| **Polling aralığı** | 60 sn yerine **90–120 sn** – duyuru güncellemesi bu gecikmeyi tolere eder. |
| **İstemci jitter** | İlk + her polling’de rastgele 0–30 sn gecikme – yükü zamana yayar. |
| **DB read replica** | Okuma yoğunluğu çok artarsa read replica ile sorgular ayrılır. |
| **Push mimarisi (uzun vade)** | WebSocket/SSE ile sunucudan güncelleme – polling ortadan kalkar; binlerce tahta için tercih edilmeli. |

### Özet: Binlerce Tahta Senaryosu

- **Cache:** Zorunlu (okul bazlı, 5–10 dk).
- **Polling:** En az 90 sn; ideal 120 sn.
- **Jitter:** Zorunlu (0–30 sn).
- **Push (WebSocket):** Uzun vadede polling’e alternatif.

---

## Performans Özet Tablosu

### Tek okul (tahta sayısı)

| Tahta sayısı | 60 sn polling | Tahmini yük | Öneri |
|--------------|---------------|-------------|-------|
| 1–30 | Düşük | Saniyede <1 istek | Ek önlem gerekmez |
| 31–80 | Orta | Saniyede 1–2 istek | Redis cache; gerekirse pool ayarı |
| 81–150 | Yüksek | Saniyede 2–3 istek | Cache zorunlu; spike için backoff |
| 150+ | Çok yüksek | Saniyede 3+ istek | Polling 90–120 sn; cache katmanı |

### Platform geneli (binlerce tahta)

| Toplam tahta | Önerilen polling | Zorunlu önlemler |
|--------------|------------------|------------------|
| 1.000+ | 90 sn | Cache, jitter |
| 5.000+ | 120 sn | Cache, jitter, DB ayarları |
| 10.000+ | 120 sn | Cache, jitter, read replica, WebSocket planı |

---

## Sonuç

1. **Duyuru TV modülü tahta ekranı için kullanılabilir.** Mevcut mimari (public API, 60 sn polling, offline cache) tek okulda 30–80 tahta için yeterli.
2. **Kasma/yığılma riski:** Tek okulda 30–50 tahta → **düşük**. 80+ tahta veya platform genelinde binlerce tahta → cache, jitter ve polling aralığı önlemleri **zorunlu**.
3. **Sınıfa özel içerik** için `device_id`/`pairing_code` parametresi ve ek sorgu gerekecek; cache ile performans korunabilir.
4. **Öneri:** Seçenek B (Hibrit) ile başlanabilir; `/tv/classroom` + `device_id` ile sınıf bazlı ders bilgisi eklenir.
5. **Ölçek planı:** 50+ tahta → Redis cache. Binlerce tahta → polling 90–120 sn, jitter, okul bazlı cache; uzun vadede WebSocket/SSE ile push.
