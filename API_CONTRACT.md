# API Sözleşmesi (Backend – Frontend)

Core Backend'in Flutter ve Next.js ile konuştuğu ortak kurallar. Detay endpoint listesi implementasyon sırasında bu yapıya göre doldurulur.

---

## 1. Temel Kurallar

- **Base URL:** Ortama göre (local / staging / production); Flutter ve Web aynı backend'e istek atar.
- **Kimlik:** Bearer token (Firebase ID token veya backend JWT); header: `Authorization: Bearer <token>`.
- **İçerik:** Request/response genelde `application/json`; dosya yükleme için `multipart/form-data`.
- **Dil:** Header `Accept-Language: tr` (opsiyonel; hata mesajları için).

---

## 2. Endpoint Listesi (İskelet)

Aşağıdaki prefix'ler ve method'lar standarttır. Her endpoint için `allowed_roles` AUTHORITY_MATRIX.md ile uyumludur. **Moderator** rolü modül bazlı yetki kullanır (`moderator_modules`).

### 2.1 Kimlik ve Okul
| Method | Path | Açıklama | Roles |
|--------|------|----------|--------|
| GET | `/me` | Giriş yapan kullanıcı (profil + rol + okul) | all |
| PATCH | `/me` | Kendi profil güncelleme. Body: display_name?, evrak_defaults?, school_id?, teacher_branch? (teacher). | all |
| PATCH | `/me/password` | Şifre değiştirme | all |
| POST | `/auth/forgot-password` | Şifre sıfırlama talebi. Body: email. Token oluşturur, e-posta gönderir (SMTP yoksa log). | public |
| POST | `/auth/reset-password` | Token ile şifre sıfırlama. Body: token, new_password (min 6 karakter). | public |
| GET | `/me/data-export` | KVKK veri dışa aktarma (JSON) | all |
| DELETE | `/me/account` | Hesap ve verileri silme (KVKK Madde 11) | all |
| GET | `/schools` | Okul listesi (sayfalı). Query: page, limit, city, district, status, type, segment, search. teacher: Hesabım Ayarlar okul seçimi için (filtre ile). | superadmin, school_admin (sadece kendi okulu), moderator (schools), teacher |
| POST | `/schools` | Okul oluştur. Body: name, type, segment, city?, district?, website_url?, phone?, about_description?, status?, teacher_limit? | superadmin |
| POST | `/schools/bulk` | Toplu okul içe aktar. Body: { schools: [{ name, type, segment, ... }] }. Response: { created, ids, errors? } | superadmin |
| GET | `/schools/:id` | Okul detay | superadmin, school_admin (kendi), moderator (schools) |
| PATCH | `/schools/:id` | Okul güncelle. school_admin: name, city, district, website_url, phone, about_description, tv_*. superadmin: +type, segment, status, teacher_limit, enabled_modules. | superadmin, school_admin |
| GET | `/users` | Kullanıcı listesi (filtre: school_id, role, status). Response: moderator_modules dahil. | superadmin, school_admin (school_id zorunlu), moderator (users) |
| POST | `/users` | Kullanıcı oluştur | superadmin, school_admin |
| GET | `/users/:id` | Kullanıcı detay. Response: moderator_modules dahil. | superadmin, school_admin (kendi okulu), teacher (kendi), moderator (users) |
| PATCH | `/users/:id` | Kullanıcı güncelle / rol atama | superadmin, school_admin (kendi okulu) |

### 2.2 Duyurular ve Haber
| Method | Path | Açıklama | Roles |
|--------|------|----------|--------|
| GET | `/announcements` | Duyuru listesi. school_admin: school_id token'dan. superadmin: query school_id zorunlu. | teacher, school_admin, superadmin |
| POST | `/announcements` | Duyuru oluştur. school_admin: school_id token'dan. superadmin: body school_id zorunlu. | school_admin, superadmin |
| PATCH | `/announcements/:id` | Duyuru güncelle. Body: urgent_override_minutes (0=kapat, 5/15/30/60), tv_slide_duration_seconds, scheduled_from, scheduled_until. | school_admin |
| DELETE | `/announcements/:id` | Duyuru sil | school_admin |
| GET | `/announcements/:id` | Duyuru detay | teacher, school_admin, superadmin |
| PATCH | `/announcements/:id/read` | Okundu işaretle | teacher |
| POST | `/admin-messages` | Sistem mesajı gönder (body: school_ids, title, body). Duyuru TV'de görünmez. | superadmin, moderator (announcements) |
| GET | `/admin-messages` | Sistem mesajları listesi. school_admin: kendi okulu. superadmin: query school_id opsiyonel. | school_admin, superadmin |
| GET | `/admin-messages/:id` | Sistem mesajı detay | school_admin, superadmin |
| PATCH | `/admin-messages/:id/read` | Okundu işaretle | school_admin |
| GET | `/news` | WP genel haber feed (sayfalı, stub) | teacher |
| GET | `/news/:id` | Haber detay | teacher |
| GET | `/content/channels` | Esnek içerik kanalları (MEB Duyuruları, Yarışmalar vb.) | teacher, school_admin |
| GET | `/content/items` | İçerik listesi. Query: channel_key, content_type, source_key, city, page, limit. | teacher, school_admin |
| GET | `/content/items/:id` | İçerik detay (source_url harici link) | teacher, school_admin |
| GET | `/content/yayin-seo` | Haber Yayın sayfası SEO metadata (title, description, og_image, robots, keywords). generateMetadata için. | public |
| GET | `/content/admin/channels` | Kanal listesi | superadmin |
| POST | `/content/admin/channels` | Kanal oluştur. Body: key, label, sort_order?, is_active?, source_ids? | superadmin |
| PATCH | `/content/admin/channels/:id` | Kanal güncelle | superadmin |
| GET | `/content/admin/sources` | Kaynak listesi | superadmin |
| POST | `/content/admin/sources` | Kaynak oluştur. Body: key, label, base_url?, rss_url?, scrape_config?, sync_interval_minutes?, is_active? | superadmin |
| PATCH | `/content/admin/sources/:id` | Kaynak güncelle | superadmin |
| GET | `/content/admin/items` | İçerik listesi (admin) | superadmin |
| POST | `/content/admin/items` | Manuel içerik ekle. Body: source_id, title, summary?, source_url, content_type?, published_at?, is_active?, city_filter? | superadmin |
| PATCH | `/content/admin/items/:id` | İçerik güncelle | superadmin |
| POST | `/content/admin/sync` | Sync tetikle (RSS/scraping altyapısı henüz yok) | superadmin |
| GET | `/exam-duties` | Sınav görevi listesi (sadece yayınlanmış). Query: page, limit, category_slug. | teacher |
| GET | `/exam-duties/:id` | Sınav görevi detay | teacher |
| GET | `/exam-duties/my-assignments` | Görev çıktı işaretlenen sınavlar. Response: { exam_duty_ids, assignments: [{ exam_duty_id, preferred_exam_date }] } | teacher |
| POST | `/exam-duties/:id/assign-me` | Görev çıktı işaretle; sınav günü sabah hatırlatması alınacak. Body: preferred_exam_date? (YYYY-MM-DD; çok günlü sınavda sadece o güne). Response: { assigned } | teacher |
| POST | `/exam-duties/:id/unassign-me` | Görev çıktı işaretini geri al; sabah hatırlatması alınmayacak. Response: { unassigned } | teacher |
| GET | `/exam-duty-preferences` | Sınav görevi bildirim tercihleri (kategori × zaman). | teacher |
| PATCH | `/exam-duty-preferences` | Tercih güncelle. Body: { categories: [{ slug, pref_*, pref_exam_day_morning_time? (07:00–09:30) }] } | teacher |
| GET | `/admin/exam-duties` | Sınav görevi listesi (tümü). Query: page, limit, category_slug, status. | superadmin |
| POST | `/admin/exam-duties` | Yeni sınav görevi. Body: title, category_slug, summary?, body?, source_url?, application_start?, application_end?, application_approval_end?, result_date?, exam_date?, exam_date_end? | superadmin |
| GET | `/admin/exam-duties/:id` | Sınav görevi detay (admin) | superadmin |
| PATCH | `/admin/exam-duties/:id` | Sınav görevi güncelle | superadmin |
| DELETE | `/admin/exam-duties/:id` | Sınav görevi sil | superadmin |
| POST | `/admin/exam-duties/:id/publish` | Taslak → Yayın (tercihe uyan öğretmenlere bildirim) | superadmin |
| POST | `/admin/exam-duties/bulk-publish` | Toplu yayınlama. Body: { ids: string[] }. Response: { published, errors } | superadmin |
| POST | `/admin/exam-duties/bulk-delete` | Taslakları toplu sil (soft delete). Body: { ids: string[] }. Sadece draft olanlar silinir. Response: { deleted, errors } | superadmin |
| GET | `/admin/exam-duties/:id/target-count` | Hedef kitle sayısı (publish_now). Response: { count } | superadmin |
| GET | `/admin/exam-duties/sync-sources` | Sync kaynakları listesi (RSS) | superadmin |
| POST | `/admin/exam-duties/sync` | Sync tetikle (RSS/scrape duyuru çek). Response: { ok, message, total_created, total_restored, total_gpt_errors, quota_limit, quota_skipped, results, skipped_items } | superadmin |

### 2.3 Bildirim
| Method | Path | Açıklama | Roles |
|--------|------|----------|--------|
| GET | `/notifications` | Inbox listesi (sayfalı). Query: page, limit, event_type (duty \| announcement \| exam_duty \| belirli_gun_hafta \| timetable \| smart_board \| support = prefix filtresi) | teacher, school_admin |
| GET | `/notifications/unread-count` | Okunmamış sayı. Query: event_type (duty \| announcement = prefix) | teacher, school_admin |
| PATCH | `/notifications/:id/read` | Okundu işaretle | teacher, school_admin |
| PATCH | `/notifications/read-all` | Hepsini okundu yap | teacher, school_admin |
| DELETE | `/notifications/delete-all` | Tüm bildirimleri sil (kullanıcının kendi bildirimleri). Response: { count } | teacher, school_admin |
| DELETE | `/notifications/:id` | Tek bildirim sil | teacher, school_admin |
| GET | `/notification-preferences` | Bildirim tercihleri | teacher |
| PATCH | `/notification-preferences` | Tercih güncelle | teacher |

### 2.3.1 Destek (Tickets)
| Method | Path | Açıklama | Roles |
|--------|------|----------|--------|
| GET | `/tickets/assignable-users` | Atanabilecek kullanıcılar. Query: school_id? (superadmin için filtre) | school_admin, moderator (support), superadmin |
| GET | `/tickets/modules` | Modül listesi. Query: target_type (SCHOOL_SUPPORT \| PLATFORM_SUPPORT) | teacher, school_admin, moderator, superadmin |
| POST | `/tickets` | Yeni ticket. Body: target_type, module_id, issue_type, priority?, subject, description, attachments?, school_id? (superadmin) | teacher (sadece SCHOOL_SUPPORT), school_admin, superadmin |
| GET | `/tickets` | Ticket listesi. Query: target_type, status, module_id, priority, assigned_to, school_id, q, page, limit, list_mode? (owned \| school_inbox \| platform – school_admin için Taleplerim vs Inbox) | teacher, school_admin, moderator (support), superadmin |
| GET | `/tickets/:id` | Ticket detay + ilişkiler | role+scope |
| PATCH | `/tickets/:id` | Durum/atama/öncelik güncelle | role+scope |
| POST | `/tickets/:id/escalate` | Platforma eskale. Body: reason, extra_info? | school_admin |
| POST | `/tickets/:id/messages` | Mesaj ekle. Body: message_type (PUBLIC\|INTERNAL_NOTE), body, attachments? | role+scope |
| GET | `/tickets/:id/messages` | Mesaj listesi. Query: page, limit | role+scope |
| GET | `/ticket-modules` | Modül listesi (target_type filtresi) | teacher, school_admin, moderator, superadmin |
| GET | `/ticket-modules/admin` | Tüm modüller (pasif dahil) | superadmin |
| POST | `/ticket-modules` | Modül oluştur. Body: name, icon_key?, target_availability, is_active?, sort_order? | superadmin |
| PATCH | `/ticket-modules/:id` | Modül güncelle | superadmin |

### 2.4 Ek Ders
| Method | Path | Açıklama | Roles |
|--------|------|----------|--------|
| GET | `/extra-lesson/params/active` | Aktif yarıyıl parametreleri. Query: semester_code (ops). Teacher hesaplama için. | teacher, school_admin, superadmin |
| GET | `/extra-lesson/params/available-semesters` | Hesaplama sayfası bütçe dönemi dropdown: superadmin'in girdiği aktif dönemler. [{ semester_code, title }] | teacher, school_admin, superadmin |
| GET | `/extra-lesson/stats` | Canlı istatistikler: live_users, total_calculations. Auth yok, 15 sn cache. | public |
| POST | `/extra-lesson/stats/heartbeat` | Sayfa açıkken heartbeat. Body: { session_id }. | public |
| POST | `/extra-lesson/stats/calc` | Hesaplama yapıldığında toplam sayacı artır. | public |
| GET | `/extra-lesson/params` | Tüm parametre setleri (filtre: is_active, semester_code). | superadmin, moderator (extra_lesson_params) |
| GET | `/extra-lesson/params/:id` | Tek parametre seti detay | superadmin, moderator (extra_lesson_params) |
| POST | `/extra-lesson/params` | Yeni parametre seti. Body: semester_code, title, line_items, tax_brackets, gv_exemption_max, dv_exemption_max, stamp_duty_rate, sgk_employee_rate, ucretli_unit_scale, central_exam_roles, education_levels [{ key, label, unit_day, unit_night }], is_active, valid_from, valid_to. | superadmin, moderator (extra_lesson_params) |
| PATCH | `/extra-lesson/params/:id` | Parametre seti güncelle | superadmin, moderator (extra_lesson_params) |
| DELETE | `/extra-lesson/params/:id` | Parametre seti sil | superadmin, moderator (extra_lesson_params) |
| GET | `/extra-lesson/line-item-templates` | Gösterge tablosu (kalem şablonları). [{ key, label, type, indicator_day, indicator_night, sort_order }] | superadmin, moderator (extra_lesson_params) |
| PATCH | `/extra-lesson/line-item-templates` | Gösterge tablosunu güncelle. Body: { templates: [...] } | superadmin, moderator (extra_lesson_params) |
| POST | `/extra-lesson/params/refresh-all` | Tüm parametre setlerinin line_items ve central_exam_roles değerlerini güncel gösterge tablosuna göre yenile. Response: { updated: number } | superadmin |
| POST | `/extra-lesson/params/apply-resmi-2026` | Tüm parametre setlerinin vergi ve sözleşmeli/ücretli alanlarını (gv_exemption_max, dv_exemption_max, stamp_duty_rate, tax_brackets, sgk_employee_rate, ucretli_unit_scale) 2026 resmi değerlerine güncelle. Response: { updated: number } | superadmin |
| GET | `/extra-lesson/calculations` | Kullanıcının kayıtlı hesaplamaları (ay bazlı) | teacher |
| POST | `/extra-lesson/calculations` | Hesaplama kaydet (veya yerel sadece; spec'e göre) | teacher |

### 2.5 Evrak
| Method | Path | Açıklama | Roles |
|--------|------|----------|--------|
| GET | `/document-templates` | Şablon listesi. Query: type, sub_type, school_type, grade, section, subject_code, academic_year, active_only, page, limit. | teacher, superadmin, moderator (document_templates) |
| GET | `/document-templates/subjects` | MEB ders kataloğu. Query: grade (1–12), section (ders, secmeli, iho). Yanıt: { items: [{ code, label }] }. Grade yoksa zümre dersleri. | teacher, superadmin, moderator (document_templates) |
| GET | `/document-templates/options` | Seçenekler. Query: type (zumre, iyep_plan, bep_plan). Yanıt: { sub_types, school_types, academic_years }. | teacher, superadmin, moderator (document_templates) |
| GET | `/document-templates/:id` | Tek şablon detay | teacher, superadmin, moderator (document_templates) |
| GET | `/document-templates/:id/download` | İndirme URL'i (signed veya doğrudan). Yanıt: { download_url, filename } | teacher, superadmin, moderator (document_templates) |
| POST | `/document-templates` | Yeni şablon. Body: type, sub_type?, school_type?, grade?, section?, subject_code?, subject_label?, curriculum_model?, academic_year?, version, file_url, file_format?, is_active?, requires_merge?, form_schema?, sort_order? | superadmin, moderator (document_templates) |
| PATCH | `/document-templates/:id` | Şablon güncelle | superadmin, moderator (document_templates) |
| DELETE | `/document-templates/:id` | Şablon sil | superadmin, moderator (document_templates) |
| POST | `/documents/generate` | Form + merge ile evrak üret. Body: { template_id, form_data }. Yanıt: { download_url, filename }. requiresMerge=true şablonlar için. Üretim arşive kaydedilir. | teacher, superadmin, moderator (document_templates) |
| GET | `/documents/generations` | Kullanıcının evrak üretim arşivi. Query: limit (varsayılan 20). Yanıt: [{ id, displayLabel, grade, section, subjectCode, subjectLabel, academicYear, fileFormat, createdAt }]. | teacher, superadmin, moderator (document_templates) |
| POST | `/documents/generations/:id/redownload` | Arşiv kaydı için tekrar evrak üret. Yanıt: { download_url, filename }. Şablon silinmişse TEMPLATE_DELETED. | teacher, superadmin, moderator (document_templates) |
| GET | `/document-templates/config/subjects` | Ders kataloğu admin listesi. Query: page, limit. Yanıt: { total, page, limit, items }. Yıllık Plan İçerikleri ve Evrak bu listeden beslenir. | superadmin |
| POST | `/document-templates/config/subjects` | Yeni ders. Body: code, label, grade_min?, grade_max?, section_filter?, sort_order?, is_active? | superadmin |
| PATCH | `/document-templates/config/subjects/:id` | Ders güncelle | superadmin |
| DELETE | `/document-templates/config/subjects/:id` | Ders sil (soft delete) | superadmin |
| GET | `/work-calendar` | Çalışma takvimi listesi. Query: academic_year. Yanıt: { items: [...] }. | superadmin, moderator (document_templates) |
| GET | `/work-calendar/:id` | Tek hafta kaydı | superadmin, moderator (document_templates) |
| POST | `/work-calendar` | Yeni hafta. Body: academic_year, week_order, week_start, week_end, ay, hafta_label?, is_tatil?, tatil_label?, sort_order? | superadmin, moderator (document_templates) |
| PATCH | `/work-calendar/:id` | Hafta güncelle | superadmin, moderator (document_templates) |
| DELETE | `/work-calendar/:id` | Hafta sil | superadmin, moderator (document_templates) |
| GET | `/yillik-plan-icerik` | Yıllık plan içerik listesi. Query: subject_code, grade, academic_year. Yanıt: { items: [...] }. | superadmin, moderator (document_templates) |
| GET | `/yillik-plan-icerik/:id` | Tek plan içerik kaydı | superadmin, moderator (document_templates) |
| POST | `/yillik-plan-icerik/generate-draft` | GPT ile 36 haftalık taslak oluştur. Body: subject_code, subject_label, grade, section?, academic_year. Yanıt: { items, warnings?, token_usage? }. OPENAI_API_KEY gerekli. | superadmin, moderator (document_templates) |
| POST | `/yillik-plan-icerik/save-draft` | GPT taslağını kaydet. Body: subject_code, subject_label, grade, section?, academic_year, items[]. Mevcut plan üzerine yazar. | superadmin, moderator (document_templates) |
| POST | `/yillik-plan-icerik` | Yeni içerik. Body: subject_code, subject_label, grade, section?, academic_year, week_order, unite?, konu?, kazanimlar?, ders_saati?, sort_order? | superadmin, moderator (document_templates) |
| PATCH | `/yillik-plan-icerik/:id` | İçerik güncelle | superadmin, moderator (document_templates) |
| DELETE | `/yillik-plan-icerik/:id` | İçerik sil | superadmin, moderator (document_templates) |

### 2.6 Kazanım
| Method | Path | Açıklama | Roles |
|--------|------|----------|--------|
| GET | `/outcome-sets` | Branş/sınıf kazanım setleri listesi | teacher |
| GET | `/outcome-sets/plan-summary` | Yıllık planda verisi olan ders/sınıf/yıl listesi | superadmin, moderator (outcome_sets) |
| GET | `/outcome-sets/:id` | Set detay (items ile) | superadmin, moderator (outcome_sets) |
| POST | `/outcome-sets` | Yeni set oluştur | superadmin, moderator (outcome_sets) |
| PATCH | `/outcome-sets/:id` | Set güncelle | superadmin, moderator (outcome_sets) |
| DELETE | `/outcome-sets/:id` | Set sil | superadmin, moderator (outcome_sets) |
| POST | `/outcome-sets/import-from-plan` | Yıllık plandan içe aktar. Body: subject_code, subject_label, grade, academic_year | superadmin, moderator (outcome_sets) |
| GET | `/outcomes` | Kullanıcının ilerleme kayıtları (teacher) | teacher |
| POST | `/outcomes` | İlerleme kaydı (işlendi/ertelendi, not) | teacher |

### 2.7 Nöbet
| Method | Path | Açıklama | Roles |
|--------|------|----------|--------|
| GET | `/duty/plans` | Aktif plan (teacher: kendi nöbetleri) | teacher, school_admin |
| GET | `/duty/daily` | Günlük nöbet listesi. Query: date=YYYY-MM-DD. Yanıt: { date, max_lessons, slots[] }. max_lessons: 6–12 (ders programına göre). Slotlar lesson_cells içerir. | teacher, school_admin |
| GET | `/duty/suggest-replacement` | Yerine görevlendirme önerisi. Query: duty_slot_id. O gün nöbetçi olanlardan boş saati olanları döner (ders programına göre). | school_admin |
| GET | `/duty/daily-range` | Tarih aralığı nöbet slotları (takvim görünümleri). Query: from=YYYY-MM-DD&to=YYYY-MM-DD. Yanıt: DutySlot[]. | teacher, school_admin |
| POST | `/duty/plans` | Yeni plan oluştur (JSON slotlar ile) | school_admin |
| POST | `/duty/plans/upload` | Excel ile plan yükle (taslak) | school_admin |
| POST | `/duty/plans/:id/publish` | Plan yayınla | school_admin |
| POST | `/duty/reassign` | Yerine görevlendir | school_admin |
| POST | `/duty/mark-absent` | Gelmeyen işaretle. Body: duty_slot_id, absent_type? (raporlu\|izinli\|gelmeyen). | school_admin |
| POST | `/duty/absences` | Devamsızlık ekle (raporlu/izinli/gelmeyen). Body: user_id, date_from, date_to, absence_type, note?. | school_admin |
| GET | `/duty/absences` | Devamsızlık listesi. Query: from=, to= (YYYY-MM-DD). | school_admin |
| DELETE | `/duty/absences/:id` | Devamsızlık sil | school_admin |
| GET | `/duty/absences-for-ek-ders` | Ek ders puantaj için nöbet devamsızlık özeti. Query: from=, to= (zorunlu). | school_admin |
| POST | `/duty/plans/auto-generate` | Tek tuşla otomatik görevlendirme. Body: period_start, period_end, slots_per_day?, area_names?, version?, rotate_area_by_week? (dönerli liste). | school_admin |
| GET | `/duty/summary` | Öğretmen başına nöbet sayısı. Query: from=YYYY-MM-DD&to=YYYY-MM-DD. Yanıt: { items: [{ user_id, display_name, email, slot_count }] }. Teacher: sadece kendi sayısı. | teacher, school_admin |
| GET | `/duty/logs` | Değişiklik logları | school_admin |
| GET | `/duty/school-default-times` | Okul varsayılan nöbet saatleri (duty_start_time, duty_end_time). Yanıt: { duty_start_time, duty_end_time }. | school_admin |
| PATCH | `/duty/school-default-times` | Okul varsayılan nöbet saatlerini güncelle. Body: duty_start_time?, duty_end_time? (HH:mm). | school_admin |
| GET | `/duty/areas` | Nöbet yerleri listesi | teacher, school_admin |
| POST | `/duty/areas` | Nöbet yeri ekle | school_admin |
| PATCH | `/duty/areas/:id` | Nöbet yeri güncelle | school_admin |
| DELETE | `/duty/areas/:id` | Nöbet yeri sil | school_admin |

### 2.7a Öğretmen Ders Programı (Nöbet entegrasyonu)
| Method | Path | Açıklama | Roles |
|--------|------|----------|--------|
| GET | `/teacher-timetable` | Okul öğretmen ders programı listesi. Query: date=YYYY-MM-DD (ops.). | school_admin, teacher |
| GET | `/teacher-timetable/plan-info` | Tarih için geçerli plan bilgisi. Query: date=YYYY-MM-DD (ops., varsayılan bugün). Yanıt: { plan_id, name, valid_from, valid_until } veya null. valid_until null = açık uçlu. | school_admin, teacher |
| GET | `/teacher-timetable/me` | Öğretmenin kendi ders programı. Query: date=YYYY-MM-DD (ops.). | school_admin, teacher |
| GET | `/teacher-timetable/plans` | Plan listesi (taslak + yayınlanmış). Yanıt: [{ id, name, valid_from, valid_until?, status, entry_count }]. valid_until null = açık uçlu. | school_admin |
| GET | `/teacher-timetable/plans/:id` | Plan detayı + entries. | school_admin |
| POST | `/teacher-timetable/plans/:id/publish` | Taslak planı yayınla. Body: { valid_from, valid_until? }. valid_until null = açık uçlu (yeni program yayınlanana kadar geçerli). Overlap kontrolü; önceki açık uçlu plan otomatik sonlandırılır; teacher_timetable güncellenir; timetable.published bildirimi. | school_admin |
| PATCH | `/teacher-timetable/plans/:id` | Yayınlanmış planın geçerlilik tarihlerini güncelle. Body: { valid_from, valid_until? }. valid_until null = açık uçlu. | school_admin |
| GET | `/teacher-timetable/my-programs` | Öğretmenin kişisel program listesi. | teacher |
| POST | `/teacher-timetable/my-programs` | Yeni kişisel program oluştur. Body: name, academic_year?, term?, entries?. | teacher |
| POST | `/teacher-timetable/import-from-admin` | İdare programını (getByMe) kendi kişisel programına aktar. "İdare Programı (Aktarılan)" oluşturur. Düzenlenebilir. | teacher |
| GET | `/teacher-timetable/my-programs/:id` | Kişisel program detayı + entries. | teacher |
| PATCH | `/teacher-timetable/my-programs/:id` | Kişisel program güncelle. Body: name?, academic_year?, term?, entries?. | teacher |
| DELETE | `/teacher-timetable/my-programs/:id` | Kişisel program sil. | teacher |
| GET | `/teacher-timetable/max-lessons` | Okuldaki maksimum ders saati (6–12). Bugün geçerli plana göre. Veri yoksa 8. | school_admin, teacher |
| GET | `/teacher-timetable/example-template` | Örnek Excel şablonu indir (attachment). | school_admin |
| GET | `/teacher-timetable/by-date` | Tarih bazlı program. Query: date=YYYY-MM-DD. O tarihte geçerli plana göre. Yanıt: { [user_id]: { [lesson_num]: { class_section, subject } } }. | school_admin, teacher |
| POST | `/teacher-timetable/upload` | Excel ile ders programı yükle. Taslak plan oluşturur. Body: multipart/form-data, file. Yanıt: { imported, errors, plan_id }. Sütunlar: Öğretmen, Sınıf, Ders; opsiyonel: Gün (1-5), Saat (1-12). | school_admin |
| DELETE | `/teacher-timetable` | Okul ders programı ve tüm taslakları temizle. | school_admin |

### 2.8 Akıllı Tahta
| Method | Path | Açıklama | Roles |
|--------|------|----------|--------|
| GET | `/smart-board/status` | Modül açık mı, yetkili mi (teacher için menü görünürlük) | teacher, school_admin, superadmin |
| GET | `/smart-board/devices` | Tahta listesi. teacher: yetkiliyse kendi okulu; admin: school_id token'dan; superadmin: query school_id. | teacher, school_admin, superadmin |
| GET | `/smart-board/devices/:id` | Tek cihaz detay | school_admin, superadmin |
| POST | `/smart-board/devices` | Yeni tahta (pairing_code otomatik). Body: school_id? (superadmin için). | school_admin, superadmin |
| PATCH | `/smart-board/devices/:id` | Cihaz güncelle. Body: name?, room_or_location? | school_admin, superadmin |
| DELETE | `/smart-board/devices/:id` | Cihaz sil | school_admin, superadmin |
| GET | `/smart-board/schools/:schoolId/authorized-teachers` | Yetkili öğretmen listesi | school_admin, superadmin |
| POST | `/smart-board/schools/:schoolId/authorized-teachers` | Yetki ver. Body: user_id | school_admin, superadmin |
| DELETE | `/smart-board/schools/:schoolId/authorized-teachers/:userId` | Yetki kaldır | school_admin, superadmin |
| GET | `/smart-board/schools/:schoolId/sessions/today` | Bugün kim bağlandı | school_admin, superadmin |
| POST | `/smart-board/connect` | Tahtaya bağlan. Body: device_id. Tek tahta tek öğretmen. | teacher |
| POST | `/smart-board/disconnect` | Bağlantıyı sonlandır. Body: session_id | teacher, school_admin, superadmin |
| POST | `/smart-board/heartbeat` | Oturum canlı tut. Body: session_id | teacher |

### 2.9 Market
| Method | Path | Açıklama | Roles |
|--------|------|----------|--------|
| GET | `/wallet` | Bakiye + son işlemler | teacher |
| GET | `/entitlements` | Kullanıcının hakları | teacher |
| GET | `/market/catalog` | Jeton ile alınabilecek haklar | teacher |
| POST | `/market/purchase` | Jetonla hak satın al | teacher |

### 2.10 Okul Değerlendirme (School Reviews)

**Herkese açık (auth yok):**
| Method | Path | Açıklama |
|--------|------|----------|
| GET | `/school-reviews-public/criteria` | Değerlendirme kriterleri. |
| GET | `/school-reviews-public/schools` | Okul listesi (filtre: city, district, type, segment, search). |
| GET | `/school-reviews-public/schools/:id` | Okul detay + istatistik. |
| GET | `/school-reviews-public/schools/:id/reviews` | Okulun değerlendirmeleri. |
| GET | `/school-reviews-public/schools/:id/questions` | Okulun soruları. |
| GET | `/school-reviews-public/cities` | İl listesi (filtre dropdown için). |
| GET | `/school-reviews-public/districts` | İlçe listesi. Query: city (opsiyonel). |

**Auth gerekli (yorum/oylama için):**
| Method | Path | Açıklama | Roles |
|--------|------|----------|--------|
| GET | `/school-reviews/criteria` | Değerlendirme kriterleri listesi (öğretmen için, aktif olanlar). | teacher, school_admin, superadmin |
| GET | `/school-reviews/criteria/admin` | Tüm kriterler (superadmin). | superadmin |
| POST | `/school-reviews/criteria` | Kriter oluştur (slug, label, hint). | superadmin |
| PATCH | `/school-reviews/criteria/:id` | Kriter güncelle. | superadmin |
| DELETE | `/school-reviews/criteria/:id` | Kriter sil. | superadmin |
| GET | `/school-reviews/schools` | Okul listesi (filtre: city, district, type, segment, search). school_admin: sadece kendi okulu. | teacher, school_admin, superadmin |
| GET | `/school-reviews/schools/:id` | Okul detay + istatistik (ortalama puan, criteria, criteria_averages, review_view_count, yorum/soru sayısı). | teacher, school_admin, superadmin |
| POST | `/school-reviews/schools/:id/reviews` | Değerlendirme oluştur. Body: rating (kriter yoksa), criteria_ratings (kriter varsa zorunlu), comment (ops.), is_anonymous (ops.). | teacher, school_admin |
| PATCH | `/school-reviews/reviews/:id` | Kendi değerlendirmesini güncelle (rating, criteria_ratings, comment, is_anonymous). | teacher, school_admin |
| DELETE | `/school-reviews/reviews/:id` | Kendi değerlendirmesini sil. | teacher, school_admin |
| GET | `/school-reviews/schools/:id/reviews` | Okulun değerlendirmeleri listesi (criteria_ratings, is_anonymous, author_display_name). | teacher, school_admin, superadmin |
| POST | `/school-reviews/schools/:id/questions` | Soru oluştur. | teacher, school_admin |
| POST | `/school-reviews/questions/:id/answers` | Soruya cevap ver. | teacher, school_admin |
| GET | `/school-reviews/schools/:id/questions` | Okulun soruları listesi. | teacher, school_admin, superadmin |
| GET | `/school-reviews/report/:schoolId` | School admin raporu (sadece kendi school_id). | school_admin |
| GET | `/app-config/school-reviews` | Okul değerlendirme modül ayarları. | superadmin |
| PATCH | `/app-config/school-reviews` | Okul değerlendirme ayarlarını güncelle. | superadmin |

### Sınıflar ve Dersler
| Method | Path | Açıklama | Roles |
|--------|------|----------|--------|
| GET | `/classes-subjects/classes` | Okul sınıfları listesi (name, grade, section). | school_admin, teacher |
| POST | `/classes-subjects/classes` | Sınıf ekle. Body: name, grade? (1-12), section?. | school_admin |
| PATCH | `/classes-subjects/classes/:id` | Sınıf güncelle. | school_admin |
| DELETE | `/classes-subjects/classes/:id` | Sınıf sil. | school_admin |
| GET | `/classes-subjects/subjects` | Okul dersleri listesi (name, code). | school_admin, teacher |
| POST | `/classes-subjects/subjects` | Ders ekle. Body: name, code?. | school_admin |
| PATCH | `/classes-subjects/subjects/:id` | Ders güncelle. | school_admin |
| DELETE | `/classes-subjects/subjects/:id` | Ders sil. | school_admin |
| POST | `/classes-subjects/seed-defaults` | Varsayılan MEB sınıfları (1–12, A/B/C) ve derslerini ekler. Mevcut olanları atlar. Yanıt: { ok, classes_added, subjects_added }. | school_admin |

### 2.11 Diğer
| Method | Path | Açıklama | Roles |
|--------|------|----------|--------|
| GET/POST/PATCH | `/school-profiles` | Okul tanıtım (admin kendi okulu) | school_admin, superadmin |
| GET | `/tv/announcements/:audience` | Duyuru TV içeriği (corridor/teachers/classroom). Query: school_id (opsiyonel), device_id (classroom için zorunlu). Yanıtta items, school, urgent, current_slot (classroom için sınıfa özel). Auth yok. | public |
| GET | `/tv/rss-feed` | RSS haber kaynağı. Query: school_id. Okul tv_rss_url'den (TRT Haber, MEB vb.) başlıkları çeker. Yanıt: { items: [{ title }] }. Auth yok. | public |
| GET | `/tv/weather` | Otomatik hava durumu. Query: city (örn. Antalya). Open-Meteo API. Auth yok. | public |
| POST | `/tv/pair` | Cihaz eşleştirme. Body: { pairing_code }. Yanıt: ok, device_id, school_id, display_group. Auth yok. | public |
| POST | `/tv/heartbeat` | Cihaz heartbeat. Body: { device_id }. Auth yok. | public |
| GET | `/tv-devices` | Duyuru TV cihazları listesi | school_admin, superadmin |
| POST | `/tv-devices` | TV cihazı oluştur (pairing_code otomatik) | school_admin, superadmin |
| PATCH | `/tv-devices/:id` | Cihaz güncelle (name, display_group) | school_admin, superadmin |
| DELETE | `/tv-devices/:id` | Cihaz sil | school_admin, superadmin |
| GET | `/audit-logs` | Audit log listesi. Query: school_id (zorunlu), page, limit, action, from, to. | superadmin |
| GET | `/app-config/r2` | R2 depolama ayarları (secret maskeli). Yanıt: r2_account_id, r2_access_key_id, r2_secret_access_key (•••• veya null), r2_bucket, r2_public_url. | superadmin |
| POST | `/app-config/r2/test` | R2 bağlantısını test et (bucket erişimi). Yanıt: ok, message. Eksik ayarda 400 R2_NOT_CONFIGURED. | superadmin |
| PATCH | `/app-config/r2` | R2 ayarlarını güncelle. Body: r2_*, upload_max_size_mb (1–50), upload_allowed_types (string[]). | superadmin |
| GET | `/app-config/yayin-seo` | Haber Yayın sayfası SEO ayarları (admin formu için). Yanıt: title, description, og_image, robots, keywords. | superadmin |
| PATCH | `/app-config/yayin-seo` | Yayın SEO ayarlarını güncelle. Body: title?, description?, og_image?, robots? (index\|noindex), keywords?. | superadmin |
| GET | `/app-config/optik` | Optik / Açık Uçlu modül ayarları (AI/GPT, OCR, puanlama). openai_api_key maskeli. | superadmin |
| PATCH | `/app-config/optik` | Optik ayarlarını güncelle. Body: module_enabled?, default_language?, openai_api_key?, openai_model?, openai_temperature?, ocr_provider?, confidence_threshold?, grade_modes?, daily_limit_per_user?, key_text_cache_ttl_hours?. | superadmin |
| POST | `/app-config/optik/test` | OpenAI API bağlantısını test et. Yanıt: ok, message. | superadmin |
| GET | `/app-config/mail` | SMTP ayarları (şifre maskeli). Yanıt: mail_enabled, smtp_host, smtp_port, smtp_user, smtp_pass (•••• veya null), smtp_from, smtp_from_name, smtp_secure, mail_app_base_url. | superadmin |
| PATCH | `/app-config/mail` | Mail ayarlarını güncelle. Body: mail_enabled?, smtp_host?, smtp_port?, smtp_user?, smtp_pass?, smtp_from?, smtp_from_name?, smtp_secure?, mail_app_base_url?. | superadmin |
| POST | `/app-config/mail/test` | SMTP bağlantısını test et. Yanıt: ok, message. | superadmin |
| GET | `/optik/status` | Modül durumu. Yanıt: enabled, configured, ready. | teacher, school_admin |
| GET | `/optik/form-templates` | Aktif form şablonları (sistem + okul + kendi). Yanıt: FormTemplate[]. | teacher, school_admin |
| GET | `/optik/form-templates/:id/pdf` | Form şablonu PDF indir (çoktan seçmeli bubble formu). | teacher, school_admin |
| POST | `/optik/form-templates` | Özel form şablonu oluştur (okul/öğretmen). Body: name, slug, formType?, questionCount?, choiceCount?, pageSize?, examType?, gradeLevel?, subjectHint?, description?, isActive?. | teacher, school_admin |
| PATCH | `/optik/form-templates/:id` | Özel şablon güncelle (sadece sahibi). | teacher, school_admin |
| DELETE | `/optik/form-templates/:id` | Özel şablon sil (sadece sahibi). | teacher, school_admin |
| POST | `/optik/ocr` | Görüntüden metin çıkar (OpenAI Vision). Body: image_base64, language_hint?, kind?. Yanıt: text, confidence, needs_rescan. | teacher |
| POST | `/optik/grade` | Tek soru puanla (GPT). Body: template_id, question_id, mode, max_score, key_text, student_text, ocr_confidence, language?, subject?. Yanıt: GradeResultDto. | teacher |
| POST | `/optik/grade/batch` | Toplu puanlama. Body: { requests: GradeRequestDto[] }. Yanıt: { results: GradeResultDto[] }. | teacher |
| GET | `/academic-calendar` | Hafta bazlı takvim. Query: academic_year. school_id token'dan. belirliGunHafta[].assignedUsers dahil. | teacher, school_admin, superadmin |
| GET | `/academic-calendar/my-assignments` | Öğretmenin kendi Belirli Gün görevlendirmeleri (dashboard için). Query: academic_year. Yanıt: [{ id, itemTitle, weekDateStart, weekDateEnd, weekLabel, gorevTipi }]. | teacher |
| GET | `/academic-calendar/template` | Ham şablon (work_calendar haftaları + öğeler). | superadmin, school_admin |
| GET | `/academic-calendar/school-overrides` | Okul override'ları (hiddenItemIds, customItems). | school_admin |
| PATCH | `/academic-calendar/school-overrides` | Override güncelle. | school_admin |
| GET | `/academic-calendar/assignments` | Belirli Gün görevlendirmeleri. Query: academic_year. | school_admin |
| POST | `/academic-calendar/assignments` | Öğretmen görevlendir. Body: item_id, user_id, gorev_tipi? (sorumlu\|yardimci). Bildirim gönderilir. | school_admin |
| DELETE | `/academic-calendar/assignments/:id` | Görevlendirme kaldır. | school_admin |
| GET | `/site-map` | Okul scope'lu site haritası (standart - hidden + custom). school_id token'dan. | teacher, school_admin |
| GET | `/site-map/template` | Ham şablon listesi (flat). school_admin: override ayarları için okur. | superadmin, school_admin |
| POST | `/site-map/template` | Şablon öğesi ekle. Body: title, path?, description?, parentId?, sortOrder?, isActive? | superadmin |
| PATCH | `/site-map/template/:id` | Şablon öğesi güncelle | superadmin |
| DELETE | `/site-map/template/:id` | Şablon öğesi kaldır (soft: is_active=false) | superadmin |
| GET | `/site-map/school-overrides` | Okulun site haritası override'ları. Yanıt: hiddenIds, customItems. | school_admin |
| PATCH | `/site-map/school-overrides` | Override güncelle. Body: hiddenIds?, customItems? [{ id, parentId?, title, path, description?, sortOrder }]. school_id token'dan. | school_admin |
| GET | `/upload/limits` | Görsel yükleme limitleri. Yanıt: max_size_mb, allowed_types[]. Superadmin Ayarlar'dan yapılandırılır. | school_admin, superadmin |
| POST | `/upload/presign` | Görsel yükleme presigned URL al. Body: filename, contentType, purpose. Yanıt: uploadUrl, publicUrl. | school_admin, superadmin |
| GET | `/reports/me` | Öğretmen özeti | teacher |
| GET | `/reports/school` | Okul özeti | school_admin |
| GET | `/reports/platform` | Platform özeti | superadmin |

---

## 3. Request / Response Örnekleri

### 3.1 Sayfalama (liste endpoint'leri)

**Query params:**
- `page` (number, default 1)
- `limit` (number, default 20, max 100)

**Response:**
```json
{
  "total": 45,
  "page": 1,
  "limit": 20,
  "items": [ ... ]
}
```

### 3.2 Hata formatı (standart)

**HTTP status:** 4xx veya 5xx

**Body:**
```json
{
  "code": "FORBIDDEN",
  "message": "Bu işlem için yetkiniz yok.",
  "details": {}
}
```

- `code`: Uygulama hata kodu (ERROR_CODES.md ile uyumlu)
- `message`: Kullanıcıya gösterilebilecek kısa mesaj (Türkçe)
- `details`: Opsiyonel; validation hatalarında alan bazlı liste

### 3.3 Örnek: Duyuru listesi response

```json
{
  "total": 12,
  "page": 1,
  "limit": 20,
  "items": [
    {
      "id": "uuid",
      "title": "Nöbet çizelgesi güncellendi",
      "summary": "Şubat ayı nöbet listesi...",
      "importance": "high",
      "published_at": "2026-02-01T09:00:00Z",
      "read_at": null,
      "attachment_url": null
    }
  ]
}
```

### 3.4 Örnek: Push payload (backend → FCM)

Backend push gönderirken taşıması gereken minimum alanlar (NOTIFICATION_MATRIX ile uyumlu):

```json
{
  "event_type": "announcement.created",
  "entity_id": "duyuru-uuid",
  "target_screen": "haber/okulum/duyuru-uuid",
  "title": "Yeni duyuru",
  "body": "Nöbet çizelgesi güncellendi."
}
```

---

## 4. Güvenlik ve Scope

- **school_admin:** Tüm ilgili isteklerde `school_id` backend tarafından token/session'dan alınır; client'tan güvenilmez değer kabul edilmez (override yok).
- **teacher:** `user_id` ve bağlı `school_id` backend'de token'dan çıkarılır; başka kullanıcı/okul verisi dönülmez.
- **Rate limiting:** Önerilir (örn. dakikada 100 istek/kullanıcı); 429 ve `RATE_LIMIT` code.

---

*Detay endpoint parametreleri ve tüm alan tipleri implementasyon sırasında bu dokümana eklenir. AUTHORITY_MATRIX.md ve ERROR_CODES.md ile birlikte kullanılır.*
