# Bildirim ve Olay Matrisi + Deep Link Listesi

Hangi olayın kime, hangi kanalla (Inbox / Push) gideceği ve push tıklanınca hangi ekrana gidileceği.

---

## 1. Olay → Inbox / Push → Hedef Kitle

| event_type | Açıklama | Inbox | Push (varsayılan) | Hedef kitle |
|------------|----------|-------|-------------------|-------------|
| announcement.created | Yeni okul duyurusu | ✅ | Önemliyse ✅ | İlgili okulun tüm öğretmenleri |
| announcement.updated | Duyuru güncellendi | ✅ | Önemliyse ✅ | Aynı |
| news.published | WP genel haber (ops. push) | ✅ | Kullanıcı/kategori tercihine bağlı | Tüm veya filtreli |
| exam_duty.open | Sınav görevi başvuru açıldı (publish_now, apply_start) | ✅ | ✅ | Kategori takipçileri (exam_duty_preferences + notification_preferences.sinav_gorevi) |
| exam_duty.lastday | Başvuru son gün (deadline) | ✅ | ✅ | Aynı |
| exam_duty.approval_day | Onay son gün (application_approval_end) | ✅ | ✅ | Aynı |
| exam_duty.examday | Sınavdan 1 gün önce hatırlatma (exam_minus_1d) | ✅ | ✅ | Aynı |
| exam_duty.reminder | Sınavdan 1 gün sonra hatırlatma (exam_plus_1d) | ✅ | ✅ | Aynı |
| exam_duty.exam_day_morning | Sınav günü sabah hatırlatması (sadece "görev çıktı" işaretleyenlere) | ✅ | ✅ | exam_duty_assignments + pref_exam_day_morning |
| exam_duty.results | Sonuç açıklandı (opsiyonel, ileride) | ✅ | ✅ | Aynı |
| duty.published | Nöbet planı yayınlandı | ✅ | ✅ | Planladaki öğretmenler (okul) |
| duty.changed | Nöbet planı değişti | ✅ | ✅ | Aynı |
| duty.reassigned | Yerine görevlendirildi | ✅ | ✅ | Yerine atanan öğretmen |
| belirli_gun_hafta.assigned | Belirli Gün görevlendirmesi | ✅ | ✅ | Görevlendirilen öğretmen |
| belirli_gun_hafta.notification_sent | Bildirim gönderildi (okul adminine onay) | ✅ | — | Atamayı yapan okul admin |
| belirli_gun_hafta.reminder | Belirli Gün hatırlatma (3 gün önce) | ✅ | ✅ | Görevli öğretmen |
| timetable.published | Ders programı yayınlandı | ✅ | ✅ | Okuldaki tüm öğretmenler |
| wallet.earned | Jeton kazanıldı | ✅ | Ops. | İlgili kullanıcı |
| wallet.spent | Jeton harcandı | ✅ | Ops. | İlgili kullanıcı |
| entitlement.granted | Hak verildi | ✅ | Ops. | İlgili kullanıcı |
| entitlement.used | Hak kullanıldı | ✅ | — | İlgili kullanıcı |
| entitlement.expired | Hak süresi bitti | ✅ | Ops. | İlgili kullanıcı |
| document.generated | Evrak üretildi | ✅ | — | İlgili kullanıcı |
| tv.device.paired | TV cihaz eşlendi | ✅ | — | Okul admin |
| tv.device.offline | TV cihaz çevrimdışı | ✅ | Ops. | Okul admin |
| smart_board.disconnected_by_admin | Akıllı tahta bağlantısı idare tarafından sonlandırıldı | ✅ | — | Bağlantısı kesilen öğretmen |
| smart_board.session_ended_by_admin | Tahta bağlantısı idare tarafından sonlandırıldı (audit) | ✅ | — | Okul adminleri |
| system.maintenance | Bakım duyurusu | ✅ | ✅ | Hedef (tüm veya segment) |
| system.force_update | Zorunlu güncelleme | ✅ | ✅ | Tüm kullanıcılar |
| support.ticket.created | Yeni destek talebi (okul kuyruğu) | ✅ | — | Okul admin |
| support.ticket.escalated | Okul talebi üst birime iletildi | ✅ | — | Superadmin |
| support.ticket.replied | Talebinize yanıt verildi | ✅ | Ops. | Requester |
| support.ticket.assigned | Size destek talebi atandı | ✅ | — | Atanan kullanıcı |

---

## 2. Push Payload Standardı (Zorunlu Alanlar)

Her push bildirimi en az şu alanları taşır (backend → FCM → mobil):

| Alan | Tip | Açıklama |
|------|-----|----------|
| event_type | string | Yukarıdaki event_type değerlerinden biri |
| entity_id | string | İlgili kaynak id (duyuru id, nöbet id, wp post id, vb.) |
| target_screen | string | Deep link hedefi (aşağıdaki listeye uygun) |
| title | string | Kısa başlık |
| body | string | Kısa gövde metni |

Opsiyonel: `category`, `notification_type` (exam_duty için open/lastday/results/examday).

---

## 3. Deep Link / target_screen Listesi

Mobil uygulama (Flutter) bu değerleri parse edip ilgili sayfaya yönlendirir. Cold start'ta gelen push da aynı kurala göre açılır.

### 3.1 Haber ve Duyuru
| target_screen | Açıklama | Örnek route (Flutter) |
|---------------|----------|------------------------|
| haber/okulum | Okul duyuruları liste | `/haber?tab=okulum` |
| haber/okulum/:id | Okul duyuru detay | `/haber/okulum/{id}` |
| haber/genel | Genel haber listesi | `/haber?tab=genel` |
| haber/genel/:id | Genel haber detay | `/haber/genel/{id}` |

### 3.2 Sınav Görevi
| target_screen | Açıklama | Örnek route |
|---------------|----------|-------------|
| sinav-gorevi | Liste (web-admin: /sinav-gorevlerim) | Web: `/sinav-gorevlerim`; Flutter: `/sinav-gorevi` |
| sinav-gorevi/:id | Detay | `/sinav-gorevi/{id}` |

### 3.3 Nöbet
| target_screen | Açıklama | Örnek route |
|---------------|----------|-------------|
| nobet | Nöbetlerim ana | `/nobet` |
| nobet/detay | Nöbet detay (entity_id ile) | `/nobet/detay?id={entity_id}` |

### 3.4 Ders Programı
| target_screen | Açıklama | Örnek route |
|---------------|----------|-------------|
| ders-programi | Ders programı ana | `/ders-programi` |

### 3.5 Market
| target_screen | Açıklama | Örnek route |
|---------------|----------|-------------|
| market | Market ana | `/market` |
| market/haklarim | Haklarım | `/market/haklarim` |
| market/gecmis | Jeton geçmişi | `/market/gecmis` |

### 3.6 Akademik Takvim
| target_screen | Açıklama | Örnek route |
|---------------|----------|-------------|
| akademik-takvim | Akademik takvim ana | `/akademik-takvim` |

### 3.7 Destek (Support)
| target_screen | Açıklama | Örnek route |
|---------------|----------|-------------|
| support/tickets/:id | Destek talebi detay | Web: `/support/{id}`; Flutter: `/destek/{id}` |

### 3.8 Bildirim ve Diğer
| target_screen | Açıklama | Örnek route |
|---------------|----------|-------------|
| bildirimler | Inbox listesi | `/bildirimler` |
| bildirimler/:id | Tek bildirim (detaya git) | Inbox'tan entity'ye göre yönlendir |
| ayarlar | Ayarlar | `/ayarlar` |
| giris | Zorunlu güncelleme / oturum kapalı | `/giris` |

### 3.8 Genel Format

- Format: `modul[/alt sayfa][/:id]`
- `:id` veya `entity_id` query param olarak da kullanılabilir: `nobet/detay?entity_id=xxx`
- Bilinmeyen `target_screen` → varsayılan ana sayfa veya Inbox.

---

## 4. Spam Önleme Kuralları

- Aynı `event_type` + `entity_id` için aynı kullanıcıya kısa sürede (örn. 5 dakika) tekrar push gönderilmez.
- "3 yeni duyuru" gibi toplu özet bildirimi tercih edilebilir (aynı türden çok olay).
- Kullanıcı bildirim tercihleri (tür bazlı aç/kapa) her zaman uygulanır; kapalı türde push gitmez, Inbox'a yazılabilir.

---

## 5. Inbox Kaydı İçeriği

Inbox'ta saklanan her kayıt en az:
- `id`, `user_id`, `event_type`, `entity_id`, `target_screen`, `title`, `body`, `read_at`, `created_at`
- İsteğe bağlı: `category`, `metadata` (JSON)

Bildirime tıklanınca: `target_screen` + `entity_id` kullanılarak ilgili detay ekranına gidilir.

---

*MODULE_RULES (Bildirim & Olay) ve CURSOR_SPEC (Push payload standardı) ile uyumludur.*
