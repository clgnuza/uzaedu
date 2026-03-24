# Core Veri Varlıkları Özeti

Core Backend DB'deki temel entity'ler ve ilişkileri. Teknik şema değil; isim ve sorumluluk seviyesinde referans.

---

## 1. Kimlik ve Erişim

### User
- **Amaç:** Giriş yapan hesap; rol ve okul bağlantısı.
- **Ana alanlar:** id, email, display_name, role (superadmin | school_admin | teacher), school_id (nullable; teacher ve school_admin için dolu), status (active | passive | suspended), created_at, updated_at.
- **İlişkiler:** Bir User bir School'a bağlı (teacher, school_admin); superadmin için school_id null olabilir.

### School
- **Amaç:** Okul kurumu; limitler ve durum.
- **Ana alanlar:** id, name, type (ilkokul | ortaokul | lise), segment (özel | devlet), city, district, status (deneme | aktif | askıda), teacher_limit, tv_weather_city, tv_welcome_image_url, tv_youtube_url, tv_default_slide_duration, tv_rss_url, tv_night_mode_start, tv_night_mode_end, created_at, updated_at.
- **İlişkiler:** Bir School'a çok User (öğretmenler, bir admin).

### Role
- Sabit enum/const: superadmin, school_admin, teacher. Ayrı tablo olmasa da yetki mantığı buna dayanır.

---

## 2. Duyuru ve Haber

### Announcement
- **Amaç:** Okul duyurusu (school_admin oluşturur).
- **Ana alanlar:** id, school_id, title, summary, body, importance (normal | high | urgent), published_at, attachment_url (ops.), show_on_tv, tv_audience, tv_slot, tv_slide_duration_seconds, urgent_override_until, scheduled_from, scheduled_until, created_by, created_at, updated_at.
- **İlişkiler:** N → 1 School. Okundu bilgisi ayrı tablo (announcement_reads: user_id, announcement_id, read_at) veya announcement üzerinde JSON.

### News (WP kaynaklı)
- Backend'de tam tablo tutulmayabilir; WP'den çekilen metadata cache'lenebilir. Alanlar: id (veya slug), title, excerpt, link, category, published_at.

### ExamDuty (WP kaynaklı)
- Sınav görevi duyurusu; WP'den veya sync tablodan. Alanlar: id, title, category, application_start, application_end, result_date, exam_date, link, source_post_id.

---

## 3. Bildirim

### Notification (Inbox kaydı)
- **Amaç:** Uygulama içi bildirim kutusu kaydı.
- **Ana alanlar:** id, user_id, event_type, entity_id, target_screen, title, body, read_at, created_at.
- **İlişkiler:** N → 1 User.

### NotificationPreference
- **Amaç:** Kullanıcının tür bazlı push tercihleri.
- **Ana alanlar:** user_id, channel (okul_duyuru, genel_haber, sinav_gorevi, nobet, market, vb.), push_enabled (boolean).

---

## 4. Nöbet

### DutyPlan
- **Amaç:** Yayınlanmış veya taslak nöbet planı.
- **Ana alanlar:** id, school_id, version, status (draft | published), published_at, created_by, created_at.
- **İlişkiler:** N → 1 School. 1 DutyPlan → çok DutySlot.

### DutySlot
- **Amaç:** Tek bir nöbet ataması (tarih + saat + alan + öğretmen).
- **Ana alanlar:** id, duty_plan_id, date, slot_name (veya slot_id), area_name (veya area_id), user_id (atanan öğretmen), reassigned_from_user_id (ops.), note, created_at, updated_at.
- **İlişkiler:** N → 1 DutyPlan, N → 1 User.

### DutyLog
- **Amaç:** Değişiklik geçmişi (yerine görevlendirme, plan yayınlama).
- **Ana alanlar:** id, school_id, action, duty_slot_id, old_user_id, new_user_id, performed_by, created_at.

---

## 4.1. Ders Programı (Teacher Timetable)

### SchoolTimetablePlan
- **Amaç:** Okul ders programı planı – geçerlilik tarihleri, taslak/yayın.
- **Ana alanlar:** id, school_id, name, valid_from, valid_until, status (draft | published), published_at, academic_year, created_by, created_at.
- **İlişkiler:** N → 1 School. 1 SchoolTimetablePlan → çok SchoolTimetablePlanEntry.

### SchoolTimetablePlanEntry
- **Amaç:** Plan ders girdileri (taslak veya yayınlanmış).
- **Ana alanlar:** id, plan_id, user_id, day_of_week (1-5), lesson_num (1-12), class_section, subject.
- **İlişkiler:** N → 1 SchoolTimetablePlan, N → 1 User.

### TeacherTimetable
- **Amaç:** Yayınlanmış planın aktif verisi – nöbet dağılımı ve günlük tablo için.
- **Ana alanlar:** id, school_id, plan_id (nullable; null=eski model), user_id, day_of_week, lesson_num, class_section, subject.
- **İlişkiler:** N → 1 School, N → 1 User, N → 1 SchoolTimetablePlan (ops.). Tarih bazlı sorgularda plan_id ile geçerli plan seçilir.

### TeacherPersonalProgram
- **Amaç:** Öğretmenin kişisel programları (idare programından aktarma vb.).
- **Ana alanlar:** id, school_id, user_id, name, academic_year, term, entries (TeacherPersonalProgramEntry[]).

---

## 5. Market

### Wallet
- **Amaç:** Kullanıcının jeton bakiyesi.
- **Ana alanlar:** id, user_id, balance (integer), updated_at.
- **İlişkiler:** 1 → 1 User.

### WalletTransaction
- **Amaç:** Jeton kazanım/harcama geçmişi.
- **Ana alanlar:** id, user_id, type (earn | spend), amount, reason (reklam, satın_alma, vb.), reference_id (entitlement_id vb.), created_at.

### Entitlement
- **Amaç:** Kullanıcının bir “hak” tipindeki kalan miktar veya süre.
- **Ana alanlar:** id, user_id, entitlement_type (evrak_uretim, optik_okuma, tahta_kilit, vb.), quantity (sayısal) veya expires_at (süreli), created_at, updated_at.
- **İlişkiler:** N → 1 User.

### EntitlementCatalog
- **Amaç:** Jetonla satın alınabilecek hak tanımları.
- **Ana alanlar:** id, slug, name, coin_price, type (numeric | duration), default_quantity veya default_days.

---

## 6. Evrak

### DocumentTemplate
- **Amaç:** Evrak şablonu (sürümlü).
- **Ana alanlar:** id, type, sub_type?, school_type?, grade?, section?, subject_code?, subject_label?, curriculum_model?, academic_year?, version, file_url (R2 key veya tam URL), file_format (docx|xlsx|pdf), is_active, sort_order?, created_at, updated_at.
- **type:** yillik_plan, gunluk_plan, egzersiz_plan, iyep_plan, bep_plan, zumre, kulup_evrak, veli_toplanti_tutanak, aday_ogretmen_dosyasi, rehberlik_raporu, dilekce, diger.
- Sürüm güncellenince yeni satır; eskiler kalır.

### Document (opsiyonel; MVP'de sunucu arşivi yok)
- Üretilen evrakın metadata'sı (kullanıcı, şablon sürümü, oluşturulma tarihi). İleride eklenebilir.

---

## 7. Ek Ders ve Kazanım

### ExtraLessonParams
- **Amaç:** Yarıyıl bazlı parametre seti (hesaplama). Superadmin tarafından yönetilir.
- **Ana alanlar:** id, semester_code (2026-1), title, line_items (JSONB: key, label, type hourly|fixed, unit_price_day, unit_price_night, fixed_amount), tax_brackets (JSONB: max_matrah, rate_percent), gv_exemption_max, dv_exemption_max, stamp_duty_rate, central_exam_roles (JSONB), is_active, valid_from, valid_to.
- **Referans:** docs/EK_DERS_ANALIZ.md

### OutcomeSet
- **Amaç:** Branş + sınıf kazanım seti.
- **Ana alanlar:** id, subject, grade, items (JSON veya ayrı OutcomeItem tablosu: code, description).

### OutcomeProgress
- **Amaç:** Öğretmenin kazanım ilerlemesi.
- **Ana alanlar:** id, user_id, outcome_set_id, outcome_item_id, class_name (7/A), status (done | partial | postponed), note, date, created_at.
- **İlişkiler:** N → 1 User, N → 1 OutcomeSet / OutcomeItem.

---

## 8. Okul Tanıtım ve TV

### SchoolProfile
- **Amaç:** Okulun tanıtım içeriği.
- **Ana alanlar:** id, school_id, title, body, vision_mission, facilities (JSON veya metin), cover_image_url, gallery_urls (liste), status (draft | published), moderated (boolean), created_at, updated_at.

### TvDevice
- **Amaç:** Duyuru TV cihazı.
- **Ana alanlar:** id, school_id, pairing_code, name, display_group (corridor | teachers), status (online | offline), last_seen_at, created_at.

---

## 9. Olay (Event) ve Log

### Event (opsiyonel ayrı tablo)
- Bazı mimarilerde event'ler sadece kod içinde üretilip doğrudan Inbox ve push'a dönüşür; kalıcı event tablosu opsiyonel.
- Kalıcı tutulacaksa: id, event_type, entity_type, entity_id, payload (JSON), created_at.

### AuditLog
- **Amaç:** Kritik işlemlerin kaydı (kim, ne, ne zaman).
- **Ana alanlar:** id, user_id, action, resource_type, resource_id, details (JSON), ip, created_at.

---

## 10. Okul Değerlendirme (School Reviews)

### SchoolReviewCriteria
- **Amaç:** Superadmin tarafından yönetilen değerlendirme kriterleri (ÖğretmenEvrak benzeri).
- **Ana alanlar:** id, slug, label, hint (ops.), sort_order, min_score, max_score, is_active.
- **Varsayılan kriterler (projeye özel):** calisma_ortami, idari_destek, is_yuku, teknoloji, iletisim, konum_ulasim, kurum_kulturu, gelisim.

### SchoolReview
- **Amaç:** Öğretmenin okula verdiği değerlendirme (puan + yorum).
- **Ana alanlar:** id, school_id, user_id, rating (1-5, kriter varsa ortalamadan), criteria_ratings (JSONB, slug→puan), is_anonymous, comment (ops.), status (pending | approved | hidden), created_at, updated_at.
- **İlişkiler:** N → 1 School, N → 1 User.

### School
- **School entity'ye ek:** review_view_count (sayısal, okul detay görüntülenme sayısı).

### SchoolQuestion
- **Amaç:** Okul hakkında sorulan soru.
- **Ana alanlar:** id, school_id, user_id, question, status (pending | approved | hidden), created_at, updated_at.
- **İlişkiler:** N → 1 School, N → 1 User, 1 SchoolQuestion → çok SchoolQuestionAnswer.

### SchoolQuestionAnswer
- **Amaç:** Soruya verilen cevap.
- **Ana alanlar:** id, question_id, user_id, answer, status, created_at, updated_at.
- **İlişkiler:** N → 1 SchoolQuestion, N → 1 User.

### AppConfig (school_reviews)
- Modül ayarları app_config tablosunda: school_reviews_enabled, school_reviews_rating_min/max, school_reviews_moderation_mode (auto | moderation), school_reviews_allow_questions, school_reviews_questions_moderation.

---

## 11. İlişki Özeti (Şema Değil, Kavramsal)

- **User** → School (N:1)
- **Announcement** → School (N:1)
- **Notification** → User (N:1)
- **DutyPlan** → School (N:1); **DutySlot** → DutyPlan (N:1), User (N:1)
- **SchoolTimetablePlan** → School (N:1); **SchoolTimetablePlanEntry** → SchoolTimetablePlan (N:1), User (N:1); **TeacherTimetable** → School (N:1), User (N:1), SchoolTimetablePlan (N:1, ops.)
- **Wallet**, **WalletTransaction**, **Entitlement** → User (N:1)
- **OutcomeProgress** → User (N:1), OutcomeSet (N:1)
- **SchoolProfile** → School (1:1); **TvDevice** → School (N:1)
- **SchoolReviewCriteria** → global (superadmin yönetir)
- **SchoolReview**, **SchoolQuestion** → School (N:1), User (N:1); **SchoolQuestionAnswer** → SchoolQuestion (N:1), User (N:1)

---

*Implementasyon sırasında alan tipleri ve ek alanlar projeye göre genişletilir. GLOSSARY.md ile isimlendirme uyumlu tutulur.*
