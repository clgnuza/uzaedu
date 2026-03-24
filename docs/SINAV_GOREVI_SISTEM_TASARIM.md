# Sınav Görevi Sistemi – Mebhaber3 Modelinden Uyarlama

Superadmin yönettiği, öğretmenin isteğe bağlı tercih ile bildirim aldığı sınav görevi modülü tasarımı.

---

## 1. Mebhaber3 Referans Özeti

| Bileşen | Mebhaber3 | OgretmenPro (hedef) |
|---------|-----------|---------------------|
| İçerik kaynağı | WordPress (sinav-gorevi kategorisi) | Core Backend DB (exam_duties) |
| Yönetim | WP editör | Superadmin web-admin |
| Otomatik giriş | WP taslak→yayın, cron | Superadmin CRUD + opsiyonel sync |
| Tercih modeli | FCM topic aboneliği (cihaz tarafı) | notification_preferences + exam_duty_preferences (DB) |
| Hedefleme | FCM condition (topic OR) | Tercihe uyan teacher listesi → Inbox + Push |
| Bildirim zamanları | publish_now, deadline, exam-1d, exam+1d, apply_start, updated | Aynı mantık |

---

## 2. Veri Modeli

### 2.1 exam_duties (sınav görevi duyuruları)

| Alan | Tip | Açıklama |
|------|-----|----------|
| id | uuid | PK |
| title | varchar(512) | Başlık |
| category_slug | varchar(32) | meb, osym, aof, ataaof, auzef |
| summary | text | Kısa özet |
| body | text | İçerik (HTML veya plain) |
| source_url | varchar(1024) | Resmi link (başvuru sayfası vb.) |
| application_start | timestamptz | Başvuru başlangıç |
| application_end | timestamptz | Son başvuru (deadline) |
| application_approval_end | timestamptz | Başvuru onay son gün |
| result_date | timestamptz | Sonuç açıklanma |
| exam_date | timestamptz | Sınav tarihi (veya ilk oturum) |
| exam_date_end | timestamptz | Son oturum (opsiyonel) |
| status | enum | draft \| published |
| created_by_user_id | uuid | Superadmin |
| published_at | timestamptz | Yayın zamanı |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### 2.2 exam_duty_preferences (öğretmen tercihleri)

| Alan | Tip | Açıklama |
|------|-----|----------|
| user_id | uuid | PK (FK users) |
| category_slug | varchar(32) | PK – meb, osym, aof, ataaof, auzef |
| pref_publish | boolean | Yayınlanınca bildirim |
| pref_deadline | boolean | Son başvuru yaklaşınca |
| pref_exam_minus_1d | boolean | Sınavdan 1 gün önce |
| pref_exam_plus_1d | boolean | Sınavdan 1 gün sonra |
| created_at | timestamptz | |
| updated_at | timestamptz | |

Öğretmen belirli kategoriyi takip etmek istiyorsa satır eklenir. Tüm pref_* false ise kategori takibi kapalı sayılabilir veya satır silinir.

### 2.3 notification_preferences (mevcut)

- `sinav_gorevi` kanalı: push_enabled = true/false
- Master anahtar: Sınav görevi bildirimlerini tamamen kapat/aç

### 2.4 exam_duty_notification_log (spam önleme / denetim)

| Alan | Tip | Açıklama |
|------|-----|----------|
| id | uuid | PK |
| exam_duty_id | uuid | FK |
| user_id | uuid | FK |
| reason | varchar(32) | publish_now, deadline, exam_minus_1d, exam_plus_1d |
| sent_at | timestamptz | Inbox’a yazıldığı zaman |

Aynı (exam_duty_id, user_id, reason) kısa sürede tekrar gönderilmez.

---

## 3. İçerik Girişi – Otomatik ve Manuel

### 3.1 Manuel (Superadmin)

- Web-admin: Sınav Görevleri sayfası
- CRUD: Başlık, kategori, tarihler, link, içerik
- Taslak → Yayın butonu
- Yayınlanınca: `publish_now` bildirimi planlanır (hemen veya 2 dk sonra)

### 3.2 Otomatik Seçenekler

**A) WordPress sync (mebhaber3 uyumlu)**  
- WP REST API veya özel endpoint’ten sinav-gorevi kategorisi çekilir
- `.exam-container` data-* veya HTML tablo parse (mebhaber plugin formatı)
- Cron: Belirli aralıklarla sync, yeni/güncel post → exam_duties

**B) RSS / Scraping (Content modülü benzeri)**  
- ContentSource key: `exam_duty_meb`, `exam_duty_osym` vb.
- ContentItem’a exam alanları (deadline, exam_date) eklenebilir veya
- Ayrı exam_duties tablosu, sync job ContentItem → exam_duties map eder

**C) MEB/ÖSYM URL sync**  
- Bilinen duyuru sayfalarından scrape
- Config: URL listesi, parse kuralları (mevcut content-sync mantığı)

Öneri: Önce **manuel CRUD** ile başla; sync için ayrı faz.

---

## 4. Bildirim Planlama (Cron)

Mebhaber3 mantığı:

| Reason | Tetiklenme |
|--------|------------|
| publish_now | Duyuru yayınlanınca (~2 dk sonra) |
| apply_start | application_start tarihinde |
| deadline | application_end (son başvuru) tarihinde |
| exam_minus_1d | exam_date - 1 gün |
| exam_plus_1d | exam_date_end + 1 gün (veya exam_date) |

### 4.1 Cron job

- Her 5–15 dakikada çalışan job
- `published_at`, `application_start`, `application_end`, `exam_date` alanlarına göre “şimdi gönderilmesi gereken” exam_duty + reason çiftlerini bul
- Her (exam_duty, reason) için: tercihe uyan user’ları hesapla → Inbox + (tercihe göre) Push

### 4.2 Hedef kitle hesabı

```text
Hedef = teacher rolündeki aktif kullanıcılar
  AND notification_preferences.channel='sinav_gorevi' AND push_enabled=true (veya tercih yoksa default true)
  AND exam_duty_preferences.category_slug = exam_duty.category_slug
  AND ilgili pref_* (reason’a göre) = true
```

Örnek: ÖSYM duyurusu, reason=deadline  
→ exam_duty_preferences.category_slug='osym' AND pref_deadline=true olan teacher’lar

---

## 5. Push Altyapısı

OgretmenPro’da şu an:
- `createInboxEntry` var (Inbox + opsiyonel e-posta)
- FCM token saklama / topic aboneliği yok
- Backend’den FCM ile push gönderimi yok

### 5.1 Seçenek A: Cihaz token + Backend FCM

- `device_tokens` tablosu: user_id, token, platform
- Flutter login sonrası token kaydeder (POST `/me/fcm-token`)
- Bildirim zamanı: Backend, hedef kullanıcıların token’larına tek tek veya multicast ile FCM gönderir

### 5.2 Seçenek B: FCM topic (mebhaber3 benzeri)

- Flutter: Kullanıcı tercihlerine göre `cat_osym`, `pref_deadline`, `combo_cat_osym__pref_deadline` topic’lerine subscribe
- Backend: Firebase Admin ile FCM `condition` ile topic’lere gönderir
- Avantaj: Token yönetimi yok, Flutter tarafı topic aboneliğini yönetir

Öneri: **Seçenek B** – mebhaber3 ile aynı model, token tablosu gerekmez.

---

## 6. API Özeti

### 6.1 Teacher

| Method | Path | Açıklama |
|--------|------|----------|
| GET | `/exam-duties` | Liste (sayfalı). Filtre: category_slug, status=published |
| GET | `/exam-duties/:id` | Detay |
| GET | `/exam-duty-preferences` | Kullanıcının kategori + zaman tercihleri |
| PATCH | `/exam-duty-preferences` | Tercih güncelle. Body: { categories: [{ slug, pref_publish, pref_deadline, pref_exam_minus_1d, pref_exam_plus_1d }] } |

### 6.2 Superadmin

| Method | Path | Açıklama |
|--------|------|----------|
| GET | `/exam-duties/admin` | Tüm duyurular (draft + published) |
| POST | `/exam-duties/admin` | Yeni duyuru |
| PATCH | `/exam-duties/admin/:id` | Güncelle |
| DELETE | `/exam-duties/admin/:id` | Sil |
| POST | `/exam-duties/admin/:id/publish` | Taslak → Yayın |

### 6.3 FCM token (Seçenek A için)

| Method | Path | Açıklama |
|--------|------|----------|
| POST | `/me/fcm-token` | Token kaydet/güncelle. Body: { token, platform? } |

---

## 7. Web-Admin UI

### 7.1 Superadmin – Sınav Görevleri

- Menü: İçerik veya Duyurular altında “Sınav Görevleri”
- Liste: Başlık, kategori, durum, tarihler, işlemler
- Ekle/Düzenle formu: Başlık, kategori, özet, içerik, link, application_start, application_end, result_date, exam_date, exam_date_end
- Yayınla butonu
- (İleride) Sync tetikleme (WP/RSS)

### 7.2 Teacher – Hesabım / Bildirim Tercihleri

- Mevcut “Bildirimler” bölümüne “Sınav görevi duyuruları” ekle
- Master: sinav_gorevi push_enabled (tek toggle)
- Kategori + zaman tercihleri:
  - MEB, ÖSYM, AÖF, ATA-AÖF, AUZEF (checkbox veya switch)
  - Her kategori için: Yayınlanınca, Son başvuru, Sınav -1 gün, Sınav +1 gün (checkbox)
- Mebhaber3 `setting_item_notification_widget` yapısı referans

---

## 8. Uygulama Sırası

| Sıra | Bileşen | Özet |
|-----|---------|------|
| 1 | Migration | exam_duties, exam_duty_preferences, exam_duty_notification_log |
| 2 | Entity + DTO | ExamDuty, ExamDutyPreference |
| 3 | ExamDutiesService | CRUD, publish, hedef kitle hesaplama |
| 4 | ExamDutyPreferencesService | Teacher tercih CRUD |
| 5 | ExamDutySchedulerService | Cron: planlanmış bildirim tetikleme |
| 6 | NotificationsService | createInboxEntry çağrısı (mevcut) |
| 7 | Push | FCM topic veya token (Seçenek B önerilir) |
| 8 | Controller | Teacher + Admin endpoint’leri |
| 9 | Web-admin | Superadmin CRUD sayfası |
| 10 | Web-admin / Flutter | Teacher tercih UI |
| 11 | Cron job | Scheduler’ı periyodik çalıştır |

---

## 9. NOTIFICATION_MATRIX Güncellemesi

| event_type | Açıklama | Hedef |
|------------|----------|-------|
| exam_duty.open | Başvuru açıldı (publish_now) | Tercihe uyan teacher’lar |
| exam_duty.lastday | Son başvuru günü (deadline) | Tercihe uyan |
| exam_duty.results | Sonuç açıklandı | (opsiyonel) |
| exam_duty.examday | Sınav günü hatırlatma (exam_minus_1d) | Tercihe uyan |

---

## 10. WP Sync (İleride)

Mebhaber3 WP eklentisi varsa:
- Eklenti yeni REST endpoint ekleyebilir: `/wp-json/mebhaber/v3/exam-duty/feed`
- OgretmenPro backend bu endpoint’i periyodik çağırır
- Gelen post’lar parse edilip exam_duties’e yazılır
- source_post_id veya source_url ile eşleşme, güncelleme mantığı

---

*Bu doküman CURSOR_SPEC, MODULE_RULES, NOTIFICATION_MATRIX ve mebhaber3 modeli ile uyumludur.*
