# Haberler / Esnek İçerik Modülü – Uygulama Planı

Bu doküman, esnek haber/duyuru/yarışma modülünün uygulama planını içerir. Defterdoldur /topluluk/news ve /haftalik-bulten analizlerine dayanır.

---

## Faz 1: Veritabanı ve Temel API (1–2)

### 1.1 Tablolar

| Tablo | Açıklama | Ana Alanlar |
|-------|----------|--------------|
| `content_channels` | Kanallar (MEB Duyuruları, Yarışmalar vb.) | id, key, label, sort_order, is_active, created_at |
| `content_sources` | Kaynaklar (Personel GM, TEGM, TEKNOFEST vb.) | id, key, label, base_url, rss_url, scrape_config, sync_interval_minutes, last_synced_at, is_active |
| `channel_sources` | Kanal–Kaynak ilişkisi (N:N) | channel_id, source_id |
| `content_items` | Tekil içerikler | id, channel_id?, source_id, content_type, title, summary, source_url, published_at, is_active, city_filter? (il bazlı), created_at |

**content_type enum:** `news` | `announcement` | `competition` | `exam` | `project` | `event` | `document` (genişletilebilir)

### 1.2 Migration

- `backend/src/migrations/` altında TypeORM migration
- Seed: Varsayılan kanallar (MEB Duyuruları, Yarışmalar, Eğitim Duyuruları), MEB GM kaynakları

---

## Faz 2: Backend Servis ve API (3–7)

### 2.1 Modül Yapısı

```
backend/src/content/
├── content.module.ts
├── content.controller.ts          # Son kullanıcı: GET /content/*
├── content-admin.controller.ts    # Superadmin: CRUD, sync
├── content.service.ts
├── entities/
│   ├── content-channel.entity.ts
│   ├── content-source.entity.ts
│   └── content-item.entity.ts
├── dto/
│   ├── list-content-items.dto.ts
│   ├── create-content-item.dto.ts
│   └── ...
└── (sync logic – RSS/scraping, sonra)
```

### 2.2 Son Kullanıcı API

| Method | Path | Query/Body | Açıklama |
|--------|------|------------|----------|
| GET | `/content/channels` | — | Kanallar listesi (aktif) |
| GET | `/content/items` | channel_key?, content_type?, source_key?, page, limit, city? | İçerik listesi |
| GET | `/content/items/:id` | — | Detay; source_url harici link |

** Roles:** teacher, school_admin  
**İl filtre:** Query'de `city` veya token'dan `user.school?.city` ile Öğretmen Haberleri kanalı

### 2.3 Admin API

| Method | Path | Açıklama |
|--------|------|----------|
| GET | `/content/admin/channels` | Kanal listesi |
| POST | `/content/admin/channels` | Kanal oluştur |
| PATCH | `/content/admin/channels/:id` | Kanal güncelle |
| GET | `/content/admin/sources` | Kaynak listesi |
| POST | `/content/admin/sources` | Kaynak oluştur |
| PATCH | `/content/admin/sources/:id` | Kaynak güncelle |
| GET | `/content/admin/items` | İçerik listesi (filtreli) |
| POST | `/content/admin/items` | Manuel içerik ekle |
| PATCH | `/content/admin/items/:id` | İçerik güncelle |
| POST | `/content/admin/sync` | Senkronizasyon tetikle |

**Rol:** superadmin (moderator için `news` modülü opsiyonel)

---

## Faz 3: Superadmin UI (8–11)

### 3.1 Menü ve Route

- **Path:** `/haberler`
- **Menü:** Sistem bölümünde "Haberler" (Newspaper ikonu)
- **allowedRoles:** superadmin, moderator (requiredModule: `news`)
- **ROUTE_ROLES, ROUTE_MODULES** güncellemesi

### 3.2 Sayfa Yapısı

**Sekmeler veya alt sayfalar:**
1. **Genel** – Modül açık/kapalı, son sync zamanı
2. **Kanallar** – CRUD, sıra, kaynak ataması
3. **Kaynaklar** – CRUD, base_url, sync ayarları
4. **İçerikler** – Liste, manuel ekleme, sync butonu
5. **Önizleme** – Son kullanıcı görünümüne benzer

### 3.3 UI Bileşenleri

- Kanal tablosu: key, label, sıra, aktif, kaynak sayısı, aksiyonlar
- Kaynak tablosu: key, label, base_url, son sync, aksiyonlar
- İçerik tablosu: başlık, kanal, kaynak, tür, tarih, aksiyonlar
- "Şimdi Senkronize Et" butonu (sync job tetikler veya stub)

---

## Faz 4: Son Kullanıcı Web UI (12–13)

### 4.1 Route ve Menü

- **Path:** `/haberler` (veya mevcut `/news` yerine)
- **allowedRoles:** teacher, school_admin
- **Menü:** Ana menüde "Haberler" / "MEB Haberleri"

### 4.2 Tasarım Hedefleri

- **Kanal sekmeleri veya filtre:** MEB Duyuruları | Yarışmalar | Eğitim Duyuruları | …
- **Kart görünümü:** Tür badge (renkli), başlık, özet, kaynak, tarih
- **Filtre:** Tür (haber, duyuru, yarışma), kaynak dropdown
- **Detay:** Modal veya `/haberler/[id]` – "Kaynağa Git" CTA
- **Boş durum:** Skeleton, EmptyState
- **İl bilgisi varsa:** Öğretmen Haberleri kanalında yerel içerik

### 4.3 Mobil (Flutter)

- Aynı API kullanılır
- Liste + detay ekranı, pull-to-refresh
- `target_screen: "content"` veya `"content/:id"` deep link (NOTIFICATION_MATRIX)
- Modül açıksa menüde "Haberler"

---

## Faz 5: Dokümantasyon ve Modül (14)

### 5.1 Güncellenecek Dosyalar

- **API_CONTRACT.md** – Yeni endpoint'ler
- **AUTHORITY_MATRIX.md** – Route ve API erişim tablosu
- **MODULE_RULES.md** – `news` modülü kuralları
- **CORE_ENTITIES.md** – content_channels, content_sources, content_items
- **backend/src/types/enums.ts** – `news` → MODERATOR_MODULES (opsiyonel)
- **enabled_modules** – Okul/sistem feature flag (opsiyonel)

### 5.2 Modül Anahtarı

- `news` veya `content` – enabled_modules içinde kontrol
- Moderator: `requiredModule: 'news'` ile /haberler erişimi

---

## Uygulama Sırası (Todo Eşlemesi)

| Sıra | Todo ID | İş |
|------|---------|-----|
| 1 | 1, 2 | DB migration + channel_sources |
| 2 | 3 | Entity'ler |
| 3 | 4, 5, 6 | ContentService, son kullanıcı API, admin API |
| 4 | 7 | İl bazlı filtre (opsiyonel, ilk sprint’te basit) |
| 5 | 8, 9, 10, 11 | Superadmin UI |
| 6 | 12, 13 | Son kullanıcı web UI |
| 7 | 14 | Dokümantasyon |

---

## Opsiyonel / İkinci Sprint

- **RSS/Scraping:** MEB sitelerinden otomatik veri çekme
- **Cron job:** Periyodik sync
- **Dashboard widget:** Son 3–5 haber özeti
- **Flutter ekranları:** Tam implementasyon
- **Push bildirimi:** Önemli yeni içerik için

---

## Başlangıç Komutu

Plan onaylandıktan sonra sırayla:
1. Migration + entity'ler
2. ContentModule, Service, Controller'lar
3. Superadmin /haberler sayfası
4. Son kullanıcı /haberler sayfası
5. API_CONTRACT, AUTHORITY_MATRIX güncellemesi
