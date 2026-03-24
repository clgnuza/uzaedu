# Sınav Görevi – Mebhaber3 / Examv3 Akış Analizi

WordPress eklentisi ve examv3 modülünün sınav görevi ekleme akışının detaylı analizi. OgretmenPro ile karşılaştırma.

---

## OgretmenPro – Superadmin Sınav Görevi Eklem Akışı (Güncel)

Aşağıdaki akış proje kodundan çıkarılmıştır (`backend/src/exam-duties/*`, `web-admin/.../sinav-gorevleri`).

### Adım Adım

| # | Kim | Ne | API / UI |
|---|-----|----|----------|
| 1 | Superadmin | Web-admin → Sınav Görevleri sayfasına girer | `GET /admin/exam-duties` |
| 2 | | "Yeni Ekle" tıklar | Modal açılır |
| 3 | | Formu doldurur: title, category_slug (meb/osym/aof/ataaof/auzef), summary, body, source_url, application_start, application_end, exam_date, exam_date_end, result_date | |
| 4 | | Kaydet | `POST /admin/exam-duties` → status: **draft** |
| 5 | | Listede taslak görünür; "Yayınla" veya toplu seçip "Seçilenleri Yayınla" | |
| 6 | | Yayınla öncesi hedef kitle önizleme | `GET /admin/exam-duties/:id/target-count` |
| 7 | | Yayınla tıklar | `POST /admin/exam-duties/:id/publish` |
| 8 | Backend | status → published, published_at = now | ExamDutiesService.publish() |
| 9 | Backend | publish_now bildirimi hemen tetiklenir | sendNotificationsForReason(duty, 'publish_now') |
| 10 | | Tercihe uyan teacher'lara Inbox kaydı oluşturulur | exam_duty_preferences + notification_preferences (sinav_gorevi) |
| 11 | Cron (06:00 UTC) | apply_start, deadline, exam_minus_1d, exam_plus_1d | ExamDutySchedulerService.runScheduledNotifications() |
| 12 | Cron (07:00 UTC) | RSS sync (exam_duty_sync_sources) | ExamDutySyncService.runSync() |

### Otomatik Sync

- **exam_duty_sync_sources** tablosunda RSS URL'leri tanımlı (örn. MEB Personel GM).
- `title_keywords` ile filtre; `external_id` = link (tekrar ekleme önlenir).
- Yeni eklenen kayıtlar **taslak** olarak gelir; Superadmin manuel yayınlar veya toplu yayınlama kullanır.

### Hedef Kitle Mantığı

- `exam_duty_preferences`: category_slug × prefPublish, prefDeadline, prefExamMinus1d, prefExamPlus1d.
- `notification_preferences`: channel = sinav_gorevi, push_enabled.
- Sadece role=teacher, status=active; sinav_gorevi kapalıysa dahil edilmez.

---

## 1. Mebhaber WordPress Yapısı (Doğrulanmış – mebhaber.net)

**Kaynak:** https://mebhaber.net REST API canlı incelendi (Şubat 2026).

```
[WordPress – mebhaber.net]
├── Kategori: sinav-gorevi (id: 534) – parent
│   ├── meb (7003), osym (7005), aof (7004), ataaof (7007), auzef (7006)
├── Mebhaber eklentisi: exam_meta post meta (REST API'de expose)
├── Post: standart wp_posts, categories=[534, 7xxx]
└── REST: GET /wp-json/wp/v2/posts?categories=534 (veya alt kategori id)

         │
         ▼
[Backend / Mobil]
├── GET /wp-json/wp/v2/posts?categories=534&per_page=20
├── Her post'ta exam_meta: apply_start, deadline, exam_time, category_slug, exam_title
└── Parse → exam_duties benzeri yapı
```

**Önemli:** `GET /wp-json/wp/v2/posts?categories=534` (mebhaber v3 feed YOK, 404) **yok** (404). Veri standart WP REST API üzerinden alınır.

---

## 2. Superadmin Sınav Görevi Ekleme – Mebhaber3 Akışı

### 2.1 WordPress Tarafı (Tahmini Akış)

| Adım | Kim | Ne Yapar |
|------|-----|----------|
| 1 | Superadmin (WP admin) | WordPress → Yazılar → Yeni Ekle |
| 2 | | Kategori: **sinav-gorevi** seçer |
| 3 | | Başlık, içerik girer. Mebhaber eklentisi özel bloklar sunar: |
| 4 | | - `.exam-container` – sınav görevi yapısal veri |
| 5 | | - `data-application-start`, `data-application-end`, `data-exam-date` vb. |
| 6 | | - Veya HTML tablo: satırlarda tarih, link, açıklama |
| 7 | | Taslak olarak kaydeder |
| 8 | | Yayınla → `post_status: publish`, `post_date` set |
| 9 | | Eklenti `transition_post_status` hook ile yayın anını yakalar |

### 2.2 exam_meta ve REST API (Doğrulanmış – mebhaber.net)

**exam_meta yapısı (canlı API yanıtı):**

```
apply_start, apply_start_ts | deadline, deadline_ts | exam_time, exam_time_ts | exam_times[] | category_slug | exam_title
```

| exam_meta | OgretmenPro |
|-----------|-------------|
| apply_start | application_start |
| deadline | application_end |
| exam_time | exam_date |
| exam_times | exam_date_end (map) |
| category_slug | category_slug |
- **REST API (doğrulanmış):** `GET /wp-json/wp/v2/posts?categories=534` tüm sınav görevleri; yayınlanmış post’ları döner (tarih, link, kategori dahil).
- **Cron:** Backend veya WP cron, bu endpoint’i periyodik çağırır; yeni post’lar mobil/backend’e aktarılır.

### 2.3 Bildirim Tetikleme

| Tetikleyici | Mebhaber3 | OgretmenPro |
|-------------|-----------|-------------|
| Yayın anı | `transition_post_status` → publish_now | Publish butonu → `sendNotificationsForReason(duty, 'publish_now')` |
| Son başvuru | Cron: `application_end == bugün` | ExamDutySchedulerService cron (günlük 06:00 UTC) |
| Sınav -1 gün | Cron: `exam_date - 1 == bugün` | Aynı cron |
| Sınav +1 gün | Cron: `exam_date_end + 1` veya benzeri | Aynı cron |

---

## 3. Examv3 Modülü (Tahmini)

### 3.1 Mobil Uygulama Tarafı

- **Sınav Görevleri ekranı:** WP/Mebhaber API’den veya backend’den çekilen liste.
- **Tercih ekranı:** Kategori (MEB, ÖSYM, AÖF…) + zaman (yayın, son başvuru, sınav -1, +1) seçimi.
- **FCM topic:** Tercihe göre `cat_meb`, `cat_osym`, `pref_deadline` vb. topic’lere subscribe.
- **Push:** Backend veya Firebase Cloud Functions, hedef topic’lere bildirim gönderir.

### 3.2 Tercih → Topic Eşlemesi (Örnek)

```
Öğretmen: MEB + ÖSYM takip, sadece "son başvuru" bildirimi istiyor
  → Topic: pref_deadline
  → Topic: cat_meb_pref_deadline VEYA condition: "cat_meb" in topics OR "cat_osym" in topics AND "pref_deadline" in topics
```

---

## 4. Superadmin Eklemeyi Karşılaştırma

| Özellik | Mebhaber3 (WP) | OgretmenPro |
|---------|----------------|-------------|
| **Giriş yeri** | WP admin → Yazılar | Web-admin → Sınav Görevleri |
| **Veri kaynağı** | wp_posts + exam_meta (REST API) | exam_duties tablosu |
| **Kategori** | Taxonomy veya meta | category_slug (meb, osym, aof, ataaof, auzef) |
| **Tarihler** | exam_meta: apply_start, deadline, exam_time | application_start, application_end, exam_date (DB kolonları) |
| **Taslak/Yayın** | post_status: draft/publish | status: draft/published |
| **Otomatik veri** | WP’ye manuel giriş; sync yok | RSS sync (MEB Personel GM) + manuel CRUD |
| **Bildirim** | Hook veya cron | Publish butonu + ExamDutySchedulerService |

---

## 5. Eksik / Belirsiz Noktalar (Mebhaber3)

Projede mebhaber3 kaynak kodu olmadığı için aşağıdakiler **tahmin**tir:

1. **`.exam-container` formatı:** Tam HTML/data-* yapısı bilinmiyor. Örnek bir WP post’un HTML çıktısı gerekir.
2. **REST:** Standart WP API kullanılıyor; mebhaber özel endpoint yok (404). Doğrulandı.
3. **Cron tarafı:** WP cron mu, ayrı backend cron mu kullanılıyor?
4. **Topic isimlendirme:** `cat_meb`, `pref_deadline` vb. tam liste yok.

---

## 6. OgretmenPro Uyumu

OgretmenPro’da:

- **Superadmin ekleme:** Web-admin CRUD, taslak → yayın. WP’ye gerek yok.
- **Otomatik:** RSS sync (exam_duty_sync_sources) MEB Personel GM’den çeker; title_keywords ile filtre.
- **Bildirim:** Inbox (kesin); Push ileride.
- **Tercih:** exam_duty_preferences; kategori × pref_publish, pref_deadline, pref_exam_minus_1d, pref_exam_plus_1d.

WordPress entegrasyonu **opsiyonel**. Mebhaber3 kullanılıyorsa:

- OgretmenPro backend’e WP sync job eklenebilir.
- `GET /wp-json/wp/v2/posts?categories=534` periyodik çağrılır; exam_meta parse edilir.
- Gelen veri `exam_duties` tablosuna yazılır (source_key: `wp_sync`, external_id: post_id).
- Superadmin hem manuel hem sync kaynaklı kayıtları tek listede görür.

---

## 7. Özet

| Soru | Cevap |
|------|-------|
| Mebhaber3’te superadmin nasıl ekler? | WP admin → Yeni yazı, sinav-gorevi kategorisi, özel blok/meta ile tarihler, taslak → yayın. |
| Examv3 ne yapar? | Mobilde liste + tercih UI; FCM topic ile bildirim alma. |
| OgretmenPro farkı? | WP yok; web-admin CRUD + RSS sync; benzer tercih ve bildirim mantığı. |
| WP sync gerekli mi? | Hayır. Core Backend + RSS yeterli. WP varsa ek veri kaynağı olarak kullanılabilir. |

---

## 8. Analiz Kısıtlılıkları

**Mebhaber (WordPress):** mebhaber.net REST API canlı incelendi. Kategori, exam_meta, endpoint'ler doğrulandı. Eklenti kaynak kodu yok; admin akışı ve cron tarafı varsayım.

**Examv3 (mobil):** Kaynak yok; FCM topic ve tercih yapıları tahmin.
