# Nöbet Modülü – Detaylı İnceleme Raporu

## 1. Genel Bakış

Nöbet modülü, okul nöbet planlaması, atamalar, tercihler, devamsızlık, takas ve yerine görevlendirme (coverage) akışlarını kapsar. **MEB Madde 91** uyumlu olacak şekilde tasarlanmıştır. Veri **sadece Core Backend DB**’de tutulur; scope kuralları (school_admin → school_id, teacher → user_id) uygulanır.

---

## 2. Backend Yapısı

### 2.1 Modül ve Bağımlılıklar

- **Dosya:** `backend/src/duty/duty.module.ts`
- **Entity’ler:** DutyPlan, DutySlot, DutyLog, DutyArea, DutySwapRequest, DutyPreference, DutyAbsence, DutyCoverage
- **Dış bağımlılıklar:** User, School, WorkCalendar, Notification, TeacherTimetableModule, NotificationsModule
- **Servisler:** DutyService, DutyReminderService (Cron: her gün 07:00 nöbet hatırlatması)

### 2.2 Entity’ler

| Entity | Tablo | Açıklama |
|--------|--------|----------|
| **DutyPlan** | duty_plan | Plan (draft/published), period_start/end, version, created_by, soft delete |
| **DutySlot** | duty_slot | Tekil nöbet ataması: date, shift (morning/afternoon), area_name, user_id, lesson_num, lesson_count, reassigned_from_user_id, absent_marked_at, absent_type |
| **DutyArea** | duty_area | Nöbet yeri (Koridor, Bahçe vb.), school_id, name, sort_order, **slots_required** (otomatik planlama) |
| **DutyPreference** | duty_preference | Öğretmen tercihi: date, status (available \| unavailable \| prefer), admin_confirmed_at |
| **DutyAbsence** | duty_absence | Devamsızlık: user_id, date_from, date_to, absence_type (raporlu \| izinli \| gelmeyen) |
| **DutySwapRequest** | duty_swap_request | Takas talebi: duty_slot_id, requested_by, proposed_user_id, request_type (swap \| day_change \| coverage_swap), teacher2_status, status (pending \| approved \| rejected) |
| **DutyCoverage** | duty_coverage | Gelmeyen öğretmenin ders saati bazlı kapatılması: duty_slot_id, lesson_num, covered_by_user_id |
| **DutyLog** | duty_log | İşlem kaydı: action (publish \| reassign \| absent_marked), duty_slot_id, old_user_id, new_user_id, performed_by, undo bilgisi |

### 2.3 Okul / Kullanıcı Alanları

- **School:** duty_start_time, duty_end_time, duty_education_mode (single/double), duty_max_lessons, duty_start_time_pm, duty_end_time_pm, lesson_schedule / lesson_schedule_pm, tv_duty_* (TV ekranı)
- **User:** duty_exempt, duty_exempt_reason (nöbet muafiyeti)

---

## 3. API Özeti (DutyController)

### Planlar
- `GET /duty/plans` – Liste (school_admin: tümü, teacher: kendi nöbetleri)
- `GET /duty/plans/:id` – Plan detay
- `POST /duty/plans` – Plan oluştur (slotlar JSON)
- `POST /duty/plans/auto-generate` – Tek tuşla otomatik görevlendirme
- `POST /duty/plans/:id/publish` – Yayınla
- `POST /duty/plans/:id/soft-delete` – Soft delete
- `POST /duty/plans/bulk-delete` – Toplu soft delete

### Slotlar
- `PATCH /duty/slots/:id` – Slot güncelle
- `POST /duty/plans/:id/slots` – Plana slot ekle
- `DELETE /duty/slots/:id` – Slot sil

### Günlük / Tarih Aralığı
- `GET /duty/daily?date=YYYY-MM-DD` – Günlük nöbet listesi
- `GET /duty/daily-range?from=&to=&shift=` – Tarih aralığı slotları

### Yerine Görevlendirme & Gelmeyen
- `POST /duty/reassign` – Yerine görevlendir (ReassignSlotDto)
- `POST /duty/mark-absent` – Gelmeyen işaretle (absent_type: raporlu \| izinli \| gelmeyen)
- `GET /duty/suggest-replacement` – Yerine görevlendirme önerisi (o gün boş saati olan nöbetçiler)
- `GET /duty/reassigned` – Yerine görevlendirilmiş nöbetler

### Devamsızlık
- `POST /duty/absences` – Devamsızlık ekle (user_id, date_from, date_to, absence_type, note)
- `GET /duty/absences?from=&to=` – Listele
- `DELETE /duty/absences/:id` – Sil
- `GET /duty/absences-for-ek-ders` – Ek ders puantaj özeti
- `GET /duty/absences/:id/class-schedule` – Öğretmen ders programı (boş ders görünümü)

### Tercihler
- `POST /duty/preferences` – Tercih ekle (date / day_of_week / period_from–to, status: available \| unavailable \| prefer)
- `GET /duty/preferences?from=&to=` – Listele (teacher: kendi, admin: okul)
- `PATCH /duty/preferences/:id/confirm` – Dikkate alındı (admin)
- `PATCH /duty/preferences/:id/unconfirm` – Onay geri al
- `DELETE /duty/preferences/:id` – Tercih sil (teacher)

### Takas
- `POST /duty/swap-requests` – Takas talebi (swap \| day_change \| coverage_swap)
- `GET /duty/swap-requests` – Talepler (teacher: kendi, admin: okul)
- `POST /duty/swap-requests/:id/teacher-respond` – Öğretmen B onay/red
- `POST /duty/swap-requests/:id/respond` – Admin onay/red (RespondSwapDto)

### Coverage (ders saati bazlı kapatma)
- `GET /duty/coverage?duty_slot_id=` – Slot coverage durumu
- `POST /duty/coverage/assign` – Ders saatine öğretmen ata
- `POST /duty/coverage/auto-assign` – Atanmamış saatleri otomatik ata
- `DELETE /duty/coverage/:id` – Coverage atamasını kaldır
- `GET /duty/coverage-by-date?date=` – Tarihe göre tüm coverage’lar

### Diğer
- `GET /duty/summary?from=&to=` – Öğretmen bazlı nöbet sayısı (weighted_count)
- `GET /duty/teachers?includeExempt=` – Okul öğretmenleri (muaf dahil/hariç)
- `PATCH /duty/teachers/:id/exempt` – Muafiyet güncelle
- `GET /duty/partners?date=` – O gün nöbetçi arkadaşlar
- `GET /duty/school-default-times` – Okul varsayılan nöbet/ders saatleri
- `PATCH /duty/school-default-times` – Güncelle (duty_education_mode, duty_start_time, lesson_schedule vb.)
- `GET /duty/areas` – Nöbet yerleri
- `POST /duty/areas` – Yer ekle
- `PATCH /duty/areas/:id` – Yer güncelle (name, sort_order)
- `DELETE /duty/areas/:id` – Yer sil
- `GET /duty/logs` – İşlem kaydı
- `POST /duty/undo/:log_id` – Son 24 saatteki işlemi geri al
- `POST /duty/notify-daily?date=` – O gün nöbetçilere toplu bildirim

---

## 4. Otomatik Planlama (autoGeneratePlan) Kuralları

- **Tarih aralığı:** period_start – period_end; sadece **Pazartesi–Cuma**; **work_calendar** tatil haftaları çıkarılır.
- **Vardiya:** Okul duty_education_mode (single/double) veya dto.shifts; morning / afternoon.
- **Öğretmenler:** Muaf (duty_exempt) hariç; devamsızlık (DutyAbsence) ve tercih **unavailable** otomatik hariç.
- **Alanlar:** DutyArea.slotsRequired veya dto.area_names; slots_per_day = alan sayısı × slotsRequired (max 10).
- **Dağılım kuralları (Gelişmiş):**
  - **prevent_consecutive_days** – Ardışık gün önleme (varsayılan: açık).
  - **respect_preferences** – “Tercih ediyorum” öncelik (sadece admin_confirmed_at dolu tercihler).
  - **enable_weekday_balance** – Haftaiçi gün dengesi (same_day_each_week açıksa devre dışı).
  - **prefer_fewer_lessons_day** – MEB 91/a: Az dersli güne nöbet tercihi (TeacherTimetable ile).
  - **same_day_each_week** – Her hafta aynı güne nöbet (haftada iki farklı gün engeli).
  - **max_per_week** – Haftalık maksimum nöbet (0 = sınırsız).
  - **max_per_month** – Aylık maksimum nöbet (0 = sınırsız).
  - **min_days_between** – Nöbetler arası minimum gün (**sert kural**, preferOverride ile ihlal edilmez).
- **Round-robin:** Slot bazlı atama; her slot için tarihler **en az dolu güne göre** sıralanır (Pzt/Sal/…/Cum denge).
- **Çıktı:** Taslak plan + dağıtım raporu (öğretmen × Pzt/Sal/Çar/Per/Cum, toplam).

---

## 5. Frontend Yapısı (web-admin)

### 5.1 Route’lar ve Roller

| Route | Açıklama | Roller |
|-------|----------|--------|
| `/duty` | Takvim | school_admin, teacher |
| `/duty/planlar` | Nöbet planları listesi + otomatik görevlendirme | school_admin, teacher |
| `/duty/planlar/[id]` | Plan detay, slotlar, gün gruplu tablo | school_admin, teacher |
| `/duty/gunluk-tablo` | Günlük liste | school_admin, teacher |
| `/duty/takas` | Görev devri (takas talepleri) | school_admin, teacher |
| `/duty/tercihler` | Tercihlerim | school_admin, teacher |
| `/duty/gorevlendirilen` | Yerine görevlendirmeler | school_admin |
| `/duty/gelmeyen` | Devamsızlık yönetimi | school_admin |
| `/duty/ozet` | İstatistikler | school_admin, teacher |
| `/duty/yerler` | Nöbet yerleri (Ayarlar) | school_admin |
| `/duty/ders-programi` | Ders programı (nöbet/ders saatleri) | school_admin |
| `/duty/logs` | İşlem kaydı | school_admin |
| `/tv` | TV ekranı (nöbet kartı) | school_admin |

### 5.2 Ortak Bileşenler

- **DutyNav** – Sekmeli navigasyon (Ana: Takvim, Planlar, Günlük Liste, Görev Devri, Tercihler; Yönetim: Görevlendirmeler, Devamsızlık, İstatistikler, Ayarlar, Ders Programı, Loglar, TV).
- **DutyPageHeader** – Sayfa başlığı.
- **TeacherDetailPanel** – Öğretmen detay paneli.
- **TeacherColor** – Öğretmen renk eşlemesi.
- **DutyDistributionChart** – Dağılım grafiği.
- **LessonCoverageDialog** – Gelmeyen için ders saati bazlı coverage atama.

### 5.3 Menü (menu.ts)

- Nöbet menü öğesi: `path: '/duty'`, `allowedRoles: ['school_admin', 'teacher']`.
- Alt route’lar için guard: `/duty`, `/duty/planlar`, `/duty/gorevlendirilen`, `/duty/gunluk-tablo`, `/duty/yerler`, `/duty/ozet`, `/duty/logs`, `/duty/takas`, `/duty/tercihler` tanımlı.

---

## 6. DutyService – Önemli Metodlar (Özet)

| Metod | İşlev |
|-------|--------|
| listPlans, getPlanById | Plan listesi / detay (rol scope) |
| getSlotsForDate, getDailyRoster, getSlotsForDateRange | Günlük / aralık slotları |
| createPlan, updateSlot, addSlotToPlan, deleteSlot | Plan/slot CRUD |
| publishPlan, softDeletePlan, softDeletePlansBulk | Yayın / silme |
| reassignSlot, markAbsent | Yerine görevlendir / gelmeyen işaretle |
| suggestReplacement | Yerine görevlendirme önerisi (boş ders saatine göre) |
| listSchoolTeachers, setTeacherExempt | Öğretmen listesi / muafiyet |
| listAreas, createArea, updateArea, deleteArea | Nöbet yerleri CRUD |
| getSummary | Öğretmen bazlı weighted nöbet sayısı |
| getReassignedSlots | Yerine görevlendirilmiş slotlar |
| getDutyPartners | Aynı gün nöbetçi arkadaşlar |
| createSwapRequest, teacherRespondSwap, listSwapRequests, respondSwapRequest | Takas akışı |
| createPreference, listPreferences, confirmPreference, unconfirmPreference, deletePreference | Tercih CRUD + admin onayı |
| createAbsence, listAbsences, deleteAbsence, getAbsencesForEkDers, getAbsenceClassSchedule | Devamsızlık |
| autoGeneratePlan | Tek tuşla otomatik plan (round-robin, kurallar, dağıtım raporu) |
| getCoverageStatus, assignCoverage, autoAssignCoverages, removeCoverage, getCoveragesForDate | Coverage CRUD |
| getSchoolDefaultTimes, updateSchoolDefaultTimes | Okul nöbet/ders saatleri |
| listLogs, undoAction | İşlem kaydı / geri al |
| sendDailyNotifications | Günlük nöbet bildirimi (manuel) |

---

## 7. Entegrasyonlar

- **WorkCalendar:** Tatil haftaları (is_tatil) otomatik planlama tarih listesinden çıkarılır.
- **TeacherTimetable:** Günlük ders sayısı (getLessonCountByDayForUsers) MEB 91/a “az dersli güne nöbet” kuralında kullanılır; suggestReplacement ve coverage’da boş ders bilgisi kullanılır.
- **Notifications:** DutyReminderService (Cron 07:00), sendDailyNotifications, event_type: duty.reminder, target_screen: nobet.
- **Ek ders:** getAbsencesForEkDers ile devamsızlık özeti ek ders puantajına verilir.

---

## 8. Güvenlik ve Scope

- Tüm endpoint’ler JwtAuthGuard + RolesGuard; school_admin veya teacher.
- school_admin: schoolId token/session’dan; başka okul verisi verilmez.
- teacher: Sadece kendi user_id kapsamında plan/slot/tercih/takas görür; liste filtreleri getPlanById, listPlans, listPreferences, listSwapRequests içinde uygulanır.
- Moderator: Nöbet modülü menüde özel tanım yok; menu.ts ve route guard’da duty route’ları school_admin/teacher’a açık.

---

## 9. Kritik Dosya Yolları

| Bölüm | Dosya |
|-------|--------|
| Backend modül | `backend/src/duty/duty.module.ts` |
| Backend API | `backend/src/duty/duty.controller.ts` |
| Backend iş mantığı | `backend/src/duty/duty.service.ts` |
| Hatırlatma | `backend/src/duty/duty-reminder.service.ts` |
| Entity’ler | `backend/src/duty/entities/*.entity.ts` |
| DTO’lar | `backend/src/duty/dto/*.dto.ts` |
| Layout / Nav | `web-admin/src/app/(admin)/duty/layout.tsx`, `web-admin/src/components/duty/duty-nav.tsx` |
| Planlar | `web-admin/src/app/(admin)/duty/planlar/page.tsx`, `planlar/[id]/page.tsx` |
| Diğer sayfalar | `web-admin/src/app/(admin)/duty/{gunluk-tablo,takas,tercihler,gorevlendirilen,gelmeyen,ozet,yerler,ders-programi,logs}/page.tsx` |
| Menü / guard | `web-admin/src/config/menu.ts` |

Bu rapor, nöbet modülünün yapısı, API’leri, kuralları ve frontend organizasyonunu tek dokümanda özetler.
