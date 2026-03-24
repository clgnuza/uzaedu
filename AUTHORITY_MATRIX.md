# Yetki Matrisi (Kim Ne Yapabilir)

Tüm modüller ve işlemler için rol bazlı erişim. Scope: teacher → user_id, school_admin → school_id, superadmin → global, moderator → modül bazlı (moderator_modules).

**Yetki akışı:** Superadmin okulları yönetir ve school_admin rolü atar. School_admin kendi okulunun TV ayarlarını (2 ekran: Koridor + Öğretmenler Odası), duyurularını, nöbetini vb. yönetir. **Moderator** rolü superadmin tarafından atanır; yetkileri `moderator_modules` dizisi ile modül bazlı (school_reviews, schools, users vb.) sınırlanır.

---

## 1. Modül × Rol × İşlem Özeti

| Modül | Teacher | School Admin | Moderator (modül bazlı) | Superadmin |
|-------|---------|--------------|-------------------------|------------|
| **Kimlik / Profil** | Kendi profilini görür, düzenler | Kendi okulundaki öğretmenleri listeler; ekle/çıkar/pasif (yetkiye göre) | users modülü: sadece listele, görüntüle | Tüm kullanıcılar CRUD; okul admin, moderator atama |
| **Okul Duyuruları** | Listeler, detay, okundu işaretler | Kendi okulu adına duyuru oluşturur, düzenler, yayınlar | — (okul bazlı, admin yapar) | — |
| **Genel Haber (WP)** | Listeler, detay, "webde aç" | — | — | — |
| **Sınav Görevi** | Kategori seçer, listeler, detay, takvime ekler | — | — | — |
| **Ek Ders** | Kendi hesaplamasını yapar; ay/kalem/vergi; yerel kayıt | — | extra_lesson_params: parametre CRUD | Yarıyıl parametre setleri CRUD |
| **Evrak & Plan** | Evrak türü seçer, form doldurur, PDF/Word üretir | — | document_templates: şablon CRUD | Şablon CRUD, sürümleme |
| **Kazanım Cebimde** | Kendi kazanım ilerlemesini işaretler, not alır | — | outcome_sets: set CRUD | Kazanım setleri CRUD (branş/sınıf) |
| **Nöbet** | Kendi nöbetini görür (bugün, 7 gün, takvim); değiştirmez | Plan yükler, yayınlar, yerine görevlendirir, gelmeyen işaretler, log görür | — | Nöbet modülünü okullara aç/kapa; politika (ops.) |
| **Optik Okuma** | Form şablonları listele, PDF indir, özel şablon ekle/düzenle; sınav okutur, sonuç görür | Form şablonları, PDF, özel şablon | — | Modül ayarları (AI/GPT, OCR, puanlama) |
| **Akıllı Tahta** | Kendi yetkisi varsa tahtaya bağlanır, kontrol eder | Okul bazlı modül aç/kapa; kim bağlanır; bağlantı sonlandır | — | Okul bazlı modül aç/kapa (platform) |
| **Market** | Bakiye görür, jeton kazanır/harcar, hak satın alır | — | market_policy: politika | Jeton/kampanya politikası, paket yönetimi |
| **Okullar Tanıtım** | Okul tanıtım sayfalarını görür | Kendi okulunun tanıtımını düzenler, taslak/yayın | school_profiles: moderasyon | Moderasyon (gizle); tüm okullar; schools modülü: okul listesi |
| **Okul Değerlendirme** | Okulları listeler, değerlendirme/yorum/soru yazar | Kendi okuluna ait raporu görür (sadece okuma) | school_reviews: modül ayarları, moderasyon | Modül ayarları; moderasyon |
| **Duyuru TV** | (Ops.) Bilgilendirme/izleme | Cihaz eşler, liste, status; TV ayarları (2 ekran: koridor + öğretmenler); show_tv | — | — |
| **Bildirim / Inbox** | Kendi bildirimlerini listeler, okur, tercih yönetir | Duyuru gönderince hedef okul | announcements: sistem mesajı gönder | Sistem duyurusu (ops.) |
| **Ayarlar** | Kendi tema, bildirim, cache, çıkış | Okul ayarlarına kısa yol (web) | — | Sistem durumu özeti (web) |
| **Raporlama (V2)** | Kendi özeti (son 7/30 gün) | Okul özeti (aktif öğretmen, duyuru okunma) | — | Platform özeti (DAU/WAU, modül trendi) |
| **Destek (Tickets)** | Kendi taleplerini açar, listeler, mesaj yazar | Okul içi + platform talepleri; inbox; eskale | support: okul inbox | Tüm platform talepleri; modül CRUD |

---

## 2. API Endpoint Erişim (allowed_roles)

Aşağıdaki tablo, her endpoint grubu için hangi rolün erişebileceğini tanımlar. Tüm school_admin istekleri `school_id` ile scope'lanmalıdır.

| Endpoint grubu / prefix | Teacher | School Admin | Moderator (modül) | Superadmin |
|------------------------|---------|--------------|------------------|------------|
| `GET/PATCH /me`, `GET/PATCH /users/me` | ✅ | ✅ | ✅ | ✅ |
| `GET/POST /schools` | ✅ (GET: okul seçimi) | — | ✅ (schools) | ✅ |
| `GET/PATCH /schools/:id` | — | ✅ (sadece kendi okulu) | ✅ (schools) | ✅ |
| `GET/POST /users` | — | ✅ (kendi okulu) | ✅ (users, sadece list/get) | ✅ |
| `GET/PATCH/DELETE /users/:id` | ✅ (sadece kendi) | ✅ (kendi okulu) | ✅ (users, sadece GET) | ✅ |
| `GET/POST /announcements` | ✅ (sadece listele, kendi okulu) | ✅ (kendi okulu CRUD) | — | — |
| `POST /admin-messages`, `GET /admin-messages`, `GET /admin-messages/:id` | — | ✅ (kendi okulu listele, okundu işaretle) | ✅ (announcements: gönder) | ✅ (gönder, tümünü listele) |
| `GET /announcements/:id`, `PATCH .../read` | ✅ | ✅ | — | — |
| `GET /news` (WP haber) | ✅ | — | — | — |
| `GET /content/channels`, `GET /content/items`, `GET /content/items/:id` | ✅ | ✅ | — | — |
| `GET /content/yayin-seo` (Haber Yayın SEO metadata) | — | — | — | public (auth yok) |
| `GET/POST/PATCH /content/admin/*` | — | — | — | ✅ |
| `GET /exam-duties`, `GET /exam-duties/:id` (sınav görevi listesi, detay) | ✅ | — | — | — |
| `GET/PATCH /exam-duty-preferences` (sınav görevi bildirim tercihleri) | ✅ | — | — | — |
| `GET/POST/PATCH/DELETE /admin/exam-duties`, `POST /admin/exam-duties/:id/publish` | — | — | — | ✅ |
| `GET /extra-lesson/params`, `GET/POST /extra-lesson/calculations` | ✅ (kendi) | — | ✅ (extra_lesson_params) | ✅ (params CRUD) |
| `GET /document-templates`, `POST /documents/generate` | ✅ | — | ✅ (document_templates) | ✅ (templates) |
| `GET/POST/PATCH/DELETE /work-calendar`, `GET/POST/PATCH/DELETE /yillik-plan-icerik` | — | — | ✅ (document_templates) | ✅ |
| `GET/POST /outcomes`, `GET /outcome-sets` | ✅ (kendi ilerleme) | — | ✅ (outcome_sets) | ✅ (sets) |
| `GET/POST/PATCH /duty/plans`, `POST /duty/reassign` | ✅ (sadece GET kendi) | ✅ (kendi okulu) | — | ✅ (modül aç/kapa) |
| `GET/POST /optical-exams` | ✅ (kendi) | — | — | — |
| `GET/POST /smart-board/...` | ✅ (yetkiliyse) | ✅ (kendi okulu; tahta CRUD, yetki, sonlandır) | — | ✅ (GET: okul seçerek izleme; POST/PATCH/DELETE yok) |
| `GET /wallet`, `GET /entitlements`, `POST /market/purchase` | ✅ | — | ✅ (market_policy) | ✅ (politika) |
| `GET/POST/PATCH /school-profiles` (tanıtım) | ✅ (GET) | ✅ (kendi okulu) | ✅ (school_profiles) | ✅ (moderasyon) |
| `GET/POST/PATCH /school-reviews/*` | ✅ (listele, CRUD kendi) | ✅ (kendi okulu rapor) | ✅ (school_reviews) | ✅ (modül ayarları) |
| `GET/POST/PATCH/DELETE /tv-devices` | — | ✅ (kendi okulu) | — | ✅ (tüm okullar, body.school_id) |
| `GET/PATCH /notifications`, `GET/PATCH /notification-preferences` | ✅ | — | — | — |
| `GET /reports/me`, `GET /reports/school`, `GET /reports/platform` | ✅ | ✅ | — | ✅ |
| `GET/POST /app-config/r2`, `PATCH /app-config/r2` (R2 depolama ayarları, bağlantı testi) | — | — | — | ✅ |
| `GET /app-config/yayin-seo`, `PATCH /app-config/yayin-seo` (Haber Yayın SEO ayarları) | — | — | — | ✅ |
| `GET/PATCH /app-config/optik`, `POST /app-config/optik/test` (Optik / Açık Uçlu modül ayarları) | — | — | — | ✅ |
| `GET /optik/status`, `GET /optik/form-templates`, `GET /optik/form-templates/:id/pdf` (form listesi, PDF indir) | ✅ | ✅ | — | — |
| `POST /optik/form-templates`, `PATCH /optik/form-templates/:id`, `DELETE /optik/form-templates/:id` (özel şablon CRUD) | ✅ | ✅ | — | — |
| `POST /optik/ocr`, `POST /optik/grade`, `POST /optik/grade/batch` (Açık uçlu modül) | ✅ | — | — | — |
| `GET /site-map` (okul scope'lu birleşik site haritası) | ✅ | ✅ | — | — |
| `GET /site-map/template`, `POST/PATCH/DELETE /site-map/template/*` | — | ✅ (GET: ayar için) | — | ✅ |
| `GET /site-map/school-overrides`, `PATCH /site-map/school-overrides` | — | ✅ (kendi okulu) | — | — |
| `GET /tickets/modules`, `POST/GET/PATCH /tickets`, `GET/PATCH /tickets/:id`, `POST /tickets/:id/escalate`, `GET/POST /tickets/:id/messages` | ✅ (kendi talepleri, sadece SCHOOL_SUPPORT açma) | ✅ (kendi okulu) | ✅ (support: okul inbox) | ✅ (tümü, modül CRUD) |
| `GET /ticket-modules`, `GET /ticket-modules/admin`, `POST/PATCH /ticket-modules` | ✅ (GET) | ✅ (GET) | ✅ (GET, support) | ✅ |

---

## 3. Moderator Modülleri

Moderator rolü için modül anahtarları (`moderator_modules`). Her modül yetkisi ilgili route ve API erişimini açar.

| Modül anahtarı | Route / sayfa örneği |
|----------------|----------------------|
| school_reviews | /school-reviews, /school-reviews-settings, /favoriler |
| school_profiles | /moderation |
| announcements | /send-announcement |
| schools | /schools |
| users | /users |
| market_policy | /market-policy |
| modules | /modules |
| document_templates | /document-templates |
| extra_lesson_params | /extra-lesson-params |
| outcome_sets | /outcome-sets |
| system_announcements | /system-announcements |
| support | /support/inbox |

---

## 4. Ekran / Route Erişimi (Web Admin)

| Route / sayfa | School Admin | Moderator (modül bazlı) | Superadmin |
|---------------|--------------|-------------------------|------------|
| `/` (dashboard) | ✅ | ✅ | ✅ |
| `/announcements` | ✅ | — |
| `/duty` | ✅ | — |
| `/tv` | ✅ (kendi okulunun 2 TV ekranı: koridor, öğretmenler odası) | — |
| `/school-profile` | ✅ (kendi) | — |
| `/school-reviews-report` | ✅ (kendi okulu) | — |
| `/classes-subjects` | ✅ (Sınıflar ve Dersler, kendi okulu) | — |
| `/extra-lesson-calc` (ek ders hesaplama) | — | ✅ | ✅ (teacher da erişir) |
| `/sinav-gorevleri` (superadmin: sınav görevi CRUD) | — | — | ✅ |
| `/sinav-gorevlerim` (teacher: yayınlanmış sınav görevleri) | ✅ | — | — |
| `/school-reviews` (okul listesi + değerlendirme) | — | ✅ (school_reviews) | ✅ |
| `/teachers` | ✅ (kendi okulu) | — | — |
| `/ders-programi` (Ana, Programlarım, Oluştur; admin: Ayarlar) | ✅ (school_admin: Excel yükleme, ayarlar; teacher: kendi programı görüntüleme) | — | — |
| `/settings` | ✅ (okul) | — | ✅ (R2 depolama ayarları dahil) |
| `/send-announcement` (okullara sistem mesajı gönder) | — | ✅ (announcements) | ✅ |
| `/system-messages` (merkezden gelen mesajlar) | ✅ | — |
| `/schools` | — | ✅ (schools) | ✅ |
| `/users` | — | ✅ (users) | ✅ |
| `/modules` (feature flags) | — | ✅ (modules) | ✅ |
| `/market-policy` | — | ✅ (market_policy) | ✅ |
| `/school-reviews-settings` | — | ✅ (school_reviews) | ✅ |
| `/document-templates` | — | ✅ (document_templates) | ✅ |
| `/evrak` (Evrak & Planlar – öğretmen kataloğu) | ✅ | ✅ (document_templates) | ✅ |
| `/haberler` (MEB duyuruları, yarışmalar vb.) | ✅ | — | ✅ |
| `/haberler/ayarlar` (kanal/kaynak yönetimi) | — | — | ✅ |
| `/site-haritasi` (platform bölümleri rehberi) | ✅ | ✅ | — |
| `/site-map-ayarlar` (okul: öğe gizleme / özel öğe ekleme) | ✅ | — | — |
| `/site-map-template` (şablon CRUD) | — | — | ✅ |
| `/extra-lesson-params` | — | ✅ (extra_lesson_params) | ✅ |
| `/outcome-sets` | — | ✅ (outcome_sets) | ✅ |
| `/moderation` (tanıtım) | — | ✅ (school_profiles) | ✅ |
| `/system-announcements` | — | ✅ (system_announcements) | ✅ (ops.) |
| `/optik-formlar` (Form şablonları, PDF indir, özel şablon) | ✅ | ✅ | — |
| `/optik-okuma-ayarlar` (Optik / Açık Uçlu modül ayarları) | — | — | ✅ |
| `/akilli-tahta` (Akıllı Tahta: cihazlar, yetkili öğretmenler, bugün kim bağlandı) | ✅ (kendi okulu) | — | ✅ |
| `/support` (Destek Taleplerim – öğretmen/admin kendi talepleri) | ✅ | — | ✅ (teacher da erişir) |
| `/support/inbox` (Okul Destek Inbox – okul içi talepler) | ✅ | ✅ (support) | — |
| `/support/platform` (Platform Destek Inbox – PLATFORM_SUPPORT talepleri) | — | — | ✅ |

---

## 5. Mobil (Flutter) Modül Görünürlüğü

Teacher için menüde sadece yetkili modüller görünür. Okul bazlı feature flag kapalıysa o modül gizlenir.

| Modül | Her zaman (teacher) | Okul bazlı açık mı? |
|-------|---------------------|----------------------|
| Profil | ✅ | — |
| Haber (Okulum + Genel) | ✅ | Okulum: okula bağlı |
| Sınav Görevi | ✅ | — |
| Ek Ders | ✅ | Evet (feature flag) |
| Evrak | ✅ | Evet |
| Kazanım | ✅ | Evet |
| Nöbet | ✅ | Evet |
| Optik Okuma | ✅ | Evet |
| Akıllı Tahta | ✅ | Evet (okul + kullanıcı yetkisi) |
| Market | ✅ | — |
| Ayarlar | ✅ | — |
| Okullar (Tanıtım) | ✅ | — |
| Okul Değerlendirme | ✅ | Evet (enabled_modules: school_reviews) |
| Duyuru TV | Ops. | Evet |

---

*CURSOR_SPEC ve MODULE_RULES ile uyumludur.*
