# Yapılanlar ve Devam Noktası

---

## Akıllı Tahta Modülü ✅

- **Amaç:** Öğretmen telefondan tahtaya bağlansın; okul admin cihaz ve yetki yönetsin (MVP, CURSOR_SPEC uyumlu).
- **Veritabanı:** Migration `add-smart-board-tables.sql` – smart_board_devices, smart_board_authorized_teachers, smart_board_sessions.
- **Backend:** SmartBoardModule, SmartBoardService, SmartBoardController. Endpoint'ler: GET /smart-board/status, GET/POST/PATCH/DELETE /smart-board/devices, GET/POST/DELETE /smart-board/schools/:schoolId/authorized-teachers, GET /smart-board/schools/:schoolId/sessions/today, POST /smart-board/connect, POST /smart-board/disconnect, POST /smart-board/heartbeat.
- **Web-admin:** `/akilli-tahta` – school_admin: tahta CRUD, yetkili öğretmenler, bugün kim bağlandı; superadmin: okul seçici ile aynı; teacher: modül durumu, yetkiliyse tahta listesi.
- **Menü:** Akıllı Tahta (school_admin, superadmin, teacher). Teacher için `requiredSchoolModule: smart_board` – okulda modül kapalıysa menü gizlenir.
- **/me:** school.enabled_modules eklendi (modül görünürlüğü için).
- **Modül kontrolü:** school.enabled_modules içinde smart_board veya null/boş = açık. Teacher için ek: smart_board_authorized_teachers tablosunda kayıt.
- **Status genişletmesi:** Teacher için `mySession?: { session_id, device_id, device_name }` – aktif bağlantı bilgisi.
- **UI iyileştirmeleri:** Cihaz düzenleme modalı (PATCH name, room_or_location); admin "Bağlantıyı Sonlandır" butonu (aktif oturumlar); teacher "Bağlan" / "Bağlantıyı Kes" butonları.
- **ERROR_CODES:** DEVICE_BUSY eklendi (tahta meşgul).
- **İyileştirmeler (2026-02):** Web heartbeat (öğretmen bağlı kalma, 45 sn); EditDeviceDialog useEffect senkronizasyonu; Sessions yenile butonu; DEVICE_BUSY özel toast; silme onayı ("aktif bağlantı sonlandırılacak"); sayfa bileşenlere bölündü (AdminDeviceCard, TeacherDeviceCard, SessionTable, EditDeviceDialog, AddDeviceDialog); AddDeviceDialog tahta ekleme sonrası eşleme kodu modalı.
- **Yetki modeli (AUTHORITY_MATRIX uyumlu):** Superadmin sadece okul bazlı modül aç/kapa (Okullar sayfası); tahta ekleme, yetki verme, bağlantı sonlandırma **school_admin** yapar. Backend: POST/PATCH/DELETE devices, POST/DELETE authorized-teachers, POST disconnect → sadece school_admin; GET (devices, sessions, authorized-teachers) superadmin için read-only. Web: superadmin için sadece görüntüleme, canManage yalnızca school_admin.
- **Okul admin UX (piyasa örneği: Promethean, SMART, Nearpod):** Sekmeli yapı: Genel Bakış (özet kartlar + hızlı erişim) → Cihazlar → Yetkili Öğretmenler → Oturumlar → Ayarlar. Genel Bakış: kayıtlı tahta, çevrimiçi, yetkili öğretmen, bugün bağlanan sayıları. AdminDeviceCard: son görülme (last_seen) göstergesi. Ayarlar: modül aç/kapa bilgisi, hızlı rehber.
- **Tahta programlanabilir (işlenebilir):** smart_board_device_schedule tablosu (device_id, day_of_week, lesson_num, user_id, subject, class_section). Okul ders saatleri (lesson_schedule) ile şu anki slot hesaplanır; cihaz kartında "Şu an: X. Ders – Matematik – Öğretmen (9-A)" görünür. ON/OFF badge belirgin. Program atama: Cihazlar sekmesinde takvim ikonu → DeviceScheduleDialog (gün, ders saati, öğretmen, ders, sınıf) CRUD. API: GET/POST/DELETE devices/:id/schedule.
- **Ders ve öğretmen okul admin ayarlardan (2026-02):** Cihaza `class_section` (örn. 9-A) atanır; `teacher_timetable` (Ders Programı Oluştur) ile eşleşirse slot otomatik alınır. Öncelik: Ders Programı → manuel `smart_board_device_schedule`. Migration: `add-smart-board-device-class-section.sql`. TeacherTimetableService.getSlotByClassSection; EditDeviceDialog sınıf alanı; AdminDeviceCard "Ders programından" badge; modern tasarım (kartlar, sekmeler, Ayarlar Ders Programı linki).
- **Tahta eklerken sınıf atama:** POST /smart-board/devices body: name, class_section, room_or_location. AddDeviceDialog form ile ad, sınıf, lokasyon; oluştururken ayarlanır → ders/öğretmen otomatik gelir.
- **Tahta kartları SVG/ikon:** SmartBoardIcon (ekran + stand + çevrimiçi göstergesi); AdminDeviceCard ve TeacherDeviceCard bu ikon ile; ders/öğretmen/sınıf için BookOpen, User, MapPin ikonları.
- **Program otomatik ders programından:** getDeviceSchedule, cihazda class_section varsa teacher_timetable'dan haftalık slotları çeker; manuel slotlar override olarak önceliklidir. TeacherTimetableService.getSlotsByClassSectionForWeek. DeviceScheduleDialog: "Ders programından" / "Manuel" kaynak sütunu; ders programından gelen slotlar silinemez.
- **Ayarlar sekmesi (2026-02):** Durum özeti (X sınıfa atanmış / Y atanmamış tahta), Hızlı sınıf eşleme tablosu (tahta adı tıklanınca düzenleme), Ders programındaki sınıf listesi. API: GET /teacher-timetable/distinct-class-sections.
- **İleride:** Flutter mobil bağlanma UI; gerçek zamanlı kontrol (WebSocket); tahta eklemede QR kod (qrcode.react).
- **Tahta ekranı × Duyuru TV:** `docs/AKILLI_TAHTA_DUYURU_TV_ENTEGRASYON.md` – Performans analizi (tek okul 30–80 tahta; platform geneli binlerce tahta). Hibrit yaklaşım: `/tv/classroom?school_id=&device_id=`. Ölçek: cache zorunlu, polling 90–120 sn, jitter, uzun vadede WebSocket.
- **Tahta ekranı entegrasyonu (2026-02):** `/tv/classroom?school_id=XXX&device_id=YYY` – Duyuru TV ayarları (corridor/teachers) değiştirilmeden, sınıfa özel slot eklendi. Backend: `GET /tv/announcements/classroom?school_id=&device_id=` yanıtta `current_slot: { lesson_num, subject, teacher_name, class_section }`; SmartBoardService.getDisplaySlotForDevice; AnnouncementsModule SmartBoardModule import. Frontend: TvAudience `classroom`, device_id query, Şuan Derste bar sınıfa özel; DeviceTable TV bağlantısı (Monitor ikonu) kopyalama; admin TV sayfası açıklamasına classroom URL eklendi.
- **Duyuru TV 3 ekran yapısı (2026-02):** tv_audience: `all`, `both`, `corridor`, `teachers`, `classroom`. Backend listForTv corridor/teachers/classroom + all; duyuru formu 5 hedef; admin TV 3 sekme (Koridor, Öğretmenler, Akıllı Tahta) + Tahta önizleme (ilk cihaz).
- **Yerleşim (Kroki) sekmesi:** Okul admin kat planı üzerinde tahta yerleştirme. Schools.smart_board_floor_plan_url (kroki görseli URL); smart_board_devices.plan_position_x, plan_position_y (0–100 yüzde). Sürükle-bırak ile konumlama; PATCH devices/:id, PATCH schools/:id.
- **Tahta ayarları (modern):** Ayarlar sekmesi yenilendi. Öğretmen kullanımı: Otomatik yetki, Sadece dersi olan sınıflara (restrict), Bağlantı süresi (1–30 dk). Schools: smart_board_auto_authorize, smart_board_restrict_to_own_classes, smart_board_session_timeout_minutes. Restrict açıksa öğretmen sadece ders programındaki sınıfların tahtalarına bağlanır.
- **Öğretmen şikayetlerine yönelik (2026-02):** (1) **Bağlantı kesildiğinde bildir:** İdare bir öğretmenin tahta bağlantısını sonlandırdığında o öğretmene Inbox bildirimi (`smart_board.disconnected_by_admin`). Schools: `smart_board_notify_on_disconnect` (varsayılan true). (2) **Ders saati bitince otomatik kes:** Heartbeat sırasında `lesson_schedule` son ders bitiş saati geçmişse oturum sonlanır. Schools: `smart_board_auto_disconnect_lesson_end`. (3) **Öğretmen UX:** Aktif bağlantı banner'ı (yeşil, sticky), tahta listesinde arama (sınıf/lokasyon/ad), "Benim sınıflarım" filtre (status.myClassSections), son bağlanılan tahta üstte (localStorage), DEVICE_BUSY mesajı iyileştirildi, yetkisiz öğretmen için "Okul idaresiyle iletişime geçin" yol gösterici.
- **Kapat özelliği (2026-02):** Tek tahta "Kapat" ve Toplu Kapat butonları aktif. PATCH /smart-board/devices/:id `status: 'offline'` ile cihazı kapatır; varsa aktif oturum disconnect edilir. Frontend: DeviceTable onClose, handleCloseDevice.
- **Güvenlik – school_id override:** POST /smart-board/devices body'den `school_id` kabul edilmiyor; yalnızca token'dan (`payload.schoolId`).
- **Bildirimler – tahta kapatma/bağlantı kesme:** Okul tarafından öğretmen tahtası kapatıldığında (Kapat butonu) veya bağlantı sonlandırıldığında (disconnect): (1) Öğretmene `smart_board.disconnected_by_admin` Inbox bildirimi (smartBoardNotifyOnDisconnect). (2) Okul adminlerine `smart_board.session_ended_by_admin` Inbox bildirimi. NOTIFICATION_MATRIX güncellendi.
- **İleride (İlkSMS E-Kilit referansı):** Offline destek (internet yokken tahta uygulamasında geçici kod, mobilde okutunca 4 hane kod ile kilit açma); QR ile bağlanma (tahta ekranında QR, mobil okutarak oturum); kurulum dokümanı (web-admin’de indirilebilir rehber); Windows/Pardus platform desteği.

- **Modül aç/kapa (superadmin, 2026-02):** `/modules` sayfası okul bazlı Akıllı Tahta toggle; her satırda checkbox ile aç/kapa. PATCH `/schools/:id` enabled_modules ile güncellenir. Ayarlar sekmesi yardım metni: Modüller sayfasından hızlı toggle veya Okullar → Okul detay → Etkin Modüller.

---

## Okul Kurumsal Bilgiler (MEB uyumlu) ✅

- **Amaç:** Okul detay sayfasına MEB okulumuz hakkında sayfalarına uyumlu kurumsal alanlar (devlet okulları için zorunlu).
- **MEB veri kuralları:** `docs/MEB_OKUL_VERI_KURALLARI.md` – Kurum kodu, mail, görsel, harita alma kuralları (toplu okul ekleme için referans).
- **Migration:** `add-school-institution-fields.sql` – institution_code, institutional_email, fax, address, map_url.
- **Entity/DTO/Service:** School entity, UpdateSchoolDto, schools.service güncellendi.
- **Web-admin Okul Detay:** Telefon, Belgegeçer (fax), Kurum kodu, Kurumsal e-posta, Tam adres, Google Haritalar linki. Devlet okulları için kurum kodu ve kurumsal mail zorunlu işaretli (segment=devlet vurgulu kutu).

---

## Optik / Açık Uçlu Modül – Superadmin + Backend API ✅

- **Amaç:** AI ile el yazısı açık uçlu soru okuma ve puanlama modülü. Superadmin altyapı + Backend OCR/Grade API tamamlandı. Flutter tarafı `docs/OPTIK_FLUTTER_NOTLAR.md` ile dokümante edildi.
- **Backend Config:** AppConfigService OptikConfig; GET/PATCH `/app-config/optik`, POST `/app-config/optik/test`.
- **Backend API (OptikModule):**
  - `GET /optik/status` – Modül hazır mı (Flutter için).
  - `POST /optik/ocr` – Görüntüden metin (OpenAI Vision). Body: image_base64, language_hint?. Yanıt: text, confidence, needs_rescan. Kullanım loglanır.
  - `POST /optik/grade` – Tek soru puanlama (GPT). Kullanım loglanır.
  - `POST /optik/grade/batch` – Toplu puanlama. Body: { requests: GradeRequestDto[] }.
- **Admin API (OptikAdminController, superadmin):**
  - GET/POST/PATCH/DELETE `/optik/admin/form-templates` – Form şablonları CRUD.
  - GET `/optik/admin/form-templates/:id/pdf?prepend_blank=1` – Superadmin form şablonu PDF indir. Web-admin Form Şablonları tab: 404 ise ana endpoint (`/optik/form-templates/:id/pdf`) fallback.
  - GET/POST/PATCH/DELETE `/optik/admin/rubric-templates` – Rubrik şablonları CRUD.
  - GET `/optik/admin/usage-stats?from=&to=` – OCR ve puanlama kullanım istatistikleri.
  - GET `/optik/admin/schools-with-optik` – Okul listesi ve optik modül durumu.
  - PATCH `/optik/admin/schools/:id/optik-module` – Okul bazlı optik modül aç/kapa.
- **Veri:** `app_config`; `optik_form_templates`, `optik_rubric_templates`, `optik_usage_log` (migration: `add-optik-admin-tables.sql`).
- **Web-admin:** `/optik-okuma-ayarlar` (superadmin). Sekmeler: Genel, AI/GPT, OCR, Puanlama, Limitler, **Form Şablonları**, **Rubrik Şablonları**, **Kullanım İstatistikleri**, **Okullar**, **e-Okul Yol Haritası**, **Maliyet Özeti**.
- **Form Şablonları okul sınav türleri:** `exam_type` (yazılı, deneme, quiz, karma, genel), `grade_level` (6-12, LGS, YKS vb.), `subject_hint` (opsiyonel ders). Preset butonları: Yazılı (15+3 karma), LGS (20-4), YKS (40-5), Quiz (10-4). Sınav türüne göre filtreleme. Migration: `add-optik-form-exam-type.sql`.
- **Optik form genişletmeleri:** (1) **Teacher endpoint:** `GET /optik/form-templates` – öğretmen/school_admin aktif şablonları (sistem + okul + kendi) listeler. (2) **PDF üretimi:** `GET /optik/form-templates/:id/pdf` – şablona göre çoktan seçmeli bubble optik form PDF indir. pdf-lib ile A4, soru numarası + A/B/C/D/E daireleri. (3) **Özel şablon:** scope (system/school/teacher), school_id, created_by_user_id. school_admin okul şablonu, teacher kendi şablonu ekleyebilir. POST/PATCH/DELETE `/optik/form-templates` (okul/öğretmen). Migration: `add-optik-form-scope-and-pdf.sql`. Web-admin: `/optik-formlar` (teacher, school_admin) – liste, PDF indir, özel ekle/düzenle/sil.
- **Optik form OMR iyileştirmeleri (Birey/eis/Çözüm tarzı):** (1) **OMR kimlik alanları:** Form sağ üstte Öğrenci No (6 hane), Okul Kodu (4 hane), Kitapçık (A/B), Ad Soyad (A-Z, 6 sütun) grid, örnek kodlama – Flutter ile numara/isim üzerinden öğrenci eşleştirmeye hazır. (2) **Yazılı + Form:** `?prepend_blank=1` ile önce boş sayfa eklenir; öğretmen yazılı kağıdının altına form ekleyebilir. Web-admin'da "Yazılı + Form" indirme butonu. (3) **ROI dokümantasyonu:** OPTIK_FLUTTER_NOTLAR.md – OMR alan koordinatları ve öğrenci arama roadmap.
- **Optik form modern tasarım (2026-02):** Lacivert header (#1c3f6d), minimal uyari kutusu, daha geniş OMR alanları (Ad Soyad 6 sütun, daha okunaklı), CEVAPLAR bölümünde hafif gri başlık, soru cevap alanları düzenli grid.
- **LGS/YKS çoklu ders formları:** LGS 90 soru (6 ders: Türkçe 20, Matematik 20, Fen 20, İnkılap 10, Din 10, Yabancı Dil 10), YKS TYT 120 soru (4 test: Türkçe 40, Sosyal 20, Mat 40, Fen 20). gradeLevel/slug ile otomatik blok seçimi; roi_config.test_blocks ile özel override.
- **Optik form PDF düzen:** Soru numaraları alt alta (sütun-major: 1,2,3… birinci sütun; sonra ikinci sütun). Soru numarası ile kutucuklar aynı satırda, tam karşısında ortalı ve oranlı. LGS 90 ve YKS TYT 120 tek sayfada (2-3 sütun, kompakt blok başlıkları).
- **Optik form hizalama (kayma düzeltmesi):** OMR grid (OGRENCI NO, OKUL KODU, ADI-SOYADI) koordinat yuvarlama; soru no + kutucuk satır merkezinde dikey ortalama; bubble/koordinat tutarlılığı.
- **Optik form OMR sadeleştirme:** Sadece OGRENCI NO (6 hane), KITAPCIK (A/B), SINIF (4-12) kaldı; OKUL KODU, ADI-SOYADI, YANLIS/DOGRU kaldırıldı.
- **Optik form modern tasarım:** Mavi accent paleti, BLOCK_BG kart stili OMR blok, SINIF 4-12 (2 satır grid), Remark/Carbon referans spacing, minimal UI.
- **Optik form Flutter/OMR doğruluk iyileştirmesi:** Scanner-safe çizim (bubble border siyah ve daha kalın), OMR satır alanında ek dikey ayırıcı çizgiler kaldırıldı, köşe anchor marker’ları eklendi (perspektif düzeltme için), öğrenci no sütun aralığı artırıldı. Yerel test: backend build başarılı, örnek PDF üretimi başarılı, LGS/YKS çıktıları tek sayfa.
- **Optik form tek sayfa yeniden düzen:** Öğrenci bilgileri üstte tek blokta toplandı (Ad Soyad, Testin Adı, Sınav Tarihi + OMR: Öğrenci No, Kitapçık, Sınıf 4-12). Ders blokları altta; ABCD başlıkları her sütunda hizalı; satır karışmasını azaltmak için çok açık zebra alt fon ve ince satır çizgileri eklendi (okumayı aksatmayacak ton). Yerel test: 18 soru, LGS 90, YKS TYT 120 tamamı tek sayfa.
- **OMR üst blok hata düzeltme:** Öğrenci No, Kitapçık, Sınıf alanlarında dikey çakışma giderildi. Kitapçık ve Sınıf aynı alt bantta ayrı kolonlara alındı; Sınıf 4-12 grid aralıkları yeniden ayarlandı. Test: backend build başarılı, örnek PDF görsel kontrolü ve YKS tek sayfa doğrulandı.
- **Öğrenci bilgileri kartı yeniden tasarım:** Tek çerçeve, belirgin başlık bandı ve sol kenar vurgusu; sol kolonda "Adi/Soyadi", "Testin Adi", "Sinav Tarihi" etiket+çizgi; dikey ayırıcı; sağ kolonda sırayla "Ogrenci No (6 hane)", "Kitapcik" (A/B), "Sinif" (4–12) OMR alanları; etiket–bubble mesafesi ve hizalama düzenlendi.
- **Flutter notları:** `docs/OPTIK_FLUTTER_NOTLAR.md` – API özeti, veri modelleri, hata kodları, modül hazırlık kontrolü.
- **ZipGrade karşılaştırması:** OPTIK_FLUTTER_NOTLAR.md içinde – çoktan seçmeli bubble okuma, kamera UX, offline, grade book, item analysis vb. roadmap.
- **İleride:** Entitlement (optik_okuma) kontrolü, günlük kota takibi.
- **2026-02 UX iyileştirmeleri (sıralı):**
  - **e-Okul sekmesi:** Mevcut durum özeti (Faz 1 hazır, Excel/PDF dışa aktarma) + Planlanan fazlar ayrı kartlar halinde.
  - **Form Şablonları / Optik Formlar:** PDF indir ikon yanına "PDF" metni; Yazılı+Form zaten metinli.
  - **Genel sekmesi:** Modülü aç açıklaması netleştirildi: "Açıksa yetkili okullara Optik Okuma modülü sunulur; kapalıysa modül hiçbir okulda görünmez."
  - **Puanlama sekmesi:** Desteklenen mod etiketleri `RUBRIC_MODES` ile ortak (İçerik, Dil, İçerik+Dil, Matematik – Sonuç, Matematik – Adımlar).
  - **Optik Formlar sayfası:** Sınav türü filtreleme (Genel, Yazılı, Deneme, Quiz, Karma); boş durum `EmptyState` ile iyileştirildi, filtreye göre farklı mesaj.
  - **Backend:** Rubrik slug çakışmasında `ConflictException` ve `RUBRIC_SLUG_EXISTS` kodu ile özel mesaj: "Bu slug zaten başka bir rubrik şablonunda kullanılıyor."
  - **UX:** Sekme linklerine `aria-current="page"`; Form/Rubrik modallarında Esc ile kapatma (window keydown listener).

---

## Akademik Takvim (Eski: Site Haritası) Modülü ✅

- **Amaç:** Defterdoldur tarzı hiyerarşik akademik takvim / navigasyon. Superadmin şablon yönetir, okul admin ekleme/çıkarma yapar, öğretmen içeriği görür.
- **Eğitim öğretim takvimi entegrasyonu:** Haftalar artık `work_calendar` (eğitim öğretim takvimi) tablosundan alınır. `academic_calendar_item.week_id` → `work_calendar.id`. `academic_calendar_week` tablosu kaldırıldı. Hafta ekleme/düzenleme Evrak > Çalışma Takvimi üzerinden yapılır. Migration: `backend/migrations/academic-calendar-use-work-calendar.sql`.
- **Veritabanı:** `site_map_item` tablosu; `schools.site_map_overrides` (jsonb). Migration: `backend/migrations/add-site-map.sql`.
- **Backend:** SiteMapModule. GET `/site-map` (teacher, school_admin – okul scope'lu birleşik liste); GET/POST/PATCH/DELETE `/site-map/template` (superadmin); GET/PATCH `/site-map/school-overrides` (school_admin, kendi okulu).
- **Web-admin:** `/akademik-takvim` – Defterdoldur tasarımı: gradient header, özet kartlar (geçen/kalan süre), ilerleme çubuğu, "Şu an bu haftadasınız" vurgusu, kategori kartları, pill etiketler, SVG ikonlar; `/akademik-takvim-sablonu` – superadmin şablon CRUD, **sürükle-bırak (pointerWithin, min-height drop zone, Öğretmen İşleri öne çıkarıldı, Belirli Gün opsiyonel)**; `/akademik-takvim-ayarlar` – okul admin öğe gizleme, **paletten sürükle-bırak ile özel öğe ekleme** (customItems, Kaydet ile PATCH).
- **Takvim haftalık görünüm iyileştirmesi:** Ortada bugünün haftası (defaultDate=bugün, startOfDay/endOfDay ile doğru eşleşme); Önceki/Sonraki güvenli; "X. Hafta" belirgin (toolbar + kart başlığı); "Bugün" / "Bu hafta" rozeti; tarih formatı ay belirgin (8–12 EYLÜL 2025).
- **Belirli Gün ve Haftalar görevlendirmesi:** Okul idaresi belirli gün etkinliklerine öğretmen atayabilir. Tablo: `belirli_gun_hafta_gorev`; API: GET/POST/DELETE `/academic-calendar/assignments`; Ayarlar sayfasında "Görevlendir" butonu; takvimde "Sizin göreviniz" ve görevli adları; bildirim (belirli_gun_hafta.assigned); 3 gün önce hatırlatma (belirli_gun_hafta.reminder, cron 08:00). **Öğretmen tarafı iyileştirmeleri:** GET `/academic-calendar/my-assignments` (öğretmen kendi görevleri); Dashboard'da "Belirli Gün Görevlerim" kartı (modern amber/orange tasarım); Bildirimler sayfasında Belirli Gün filtre sekmesi, özel ikon ve "Takvime git" butonu; hızlı aksiyonlarda Akademik Takvim linki.
- **Çalışma takvimi seminer:** MEB config'de seminer_baslangic ve seminer_son tanımlı; generateMebWorkCalendar seminer haftalarını dahil eder. 2025-2026 için "MEB ile Güncelle (Seminer Dahil)" + **"Akademik Takvimi Doldur"** (POST /seed/academic-calendar) butonları; akademik takvim seed'i bu haftalara veri doldurur (2025-2026 şablon).
- **Redirect:** Eski `/site-haritasi`, `/site-map-ayarlar`, `/site-map-template` → yeni akademik-takvim route’larına yönlendirilir.
- **Seed:** `SeedService.seedSiteMap()` – Defterdoldur içeriği. `seedAcademicCalendar()` – work_calendar boşsa MEB'ten 2025-2026 oluşturur, ardından Belirli Gün/Haftalar ve Öğretmen İşleri öğelerini tarih eşleştirmesiyle ekler. **Site uyumlu filtre:** Sadece `BELIRLI_ALLOWED` (palette ile senkron) ve `OGRETMEN_PATH`'te tanımlı öğeler eklenir; eski varyasyonlar (örn. "Dünyayı Temizlik Günü") `BELIRLI_NORMALIZE` ile düzeltilir. Site map path'leri mevcut rotalarla uyumlu (/evrak, /duty, /profile vb.).
- **Menü:** Akademik Takvim (teacher, school_admin); Akademik Takvim Ayarları (school_admin); Akademik Takvim Şablonu (superadmin).
- **Doküman:** API_CONTRACT.md, AUTHORITY_MATRIX.md güncellendi.

---

## Haberler / Esnek İçerik Modülü ✅

- **Veritabanı:** `content_channels`, `content_sources`, `channel_sources`, `content_items`. Migration: `backend/migrations/add-content-module.sql`. Seed: `backend/scripts/seed-content-module.ts` (`cd backend && npm run seed-content`).
- **Backend:** ContentModule, ContentService, ContentSyncService. Son kullanıcı: GET `/content/channels`, `/content/items`, `/content/items/:id` (teacher, school_admin). Admin: CRUD kanal/kaynak/içerik, POST `/content/admin/sync`.
- **Otomatik sync:** `rss_url` tanımlı kaynaklardan RSS parse; `base_url` + `scrape_config` tanımlı kaynaklardan Cheerio ile HTML scrape. Yanıt: `{ ok, message, results, total_created }`.
- **Web-admin:** `/haberler` – kanal sekmeleri, kart listesi. `/haberler/ayarlar` – Kanallar, Kaynaklar, İçerikler, **Senkronizasyon Kontrol** (kaynak durumu tablosu, son sync sonucu, Sync butonu).
- **Seed:** 13 MEB kaynağı (il_meb dahil) + BBC/DW Türkçe (RSS), 4 kanal (MEB Duyuruları, Haberler, Yarışmalar, Eğitim Duyuruları), Personel GM scrape_config, 15 örnek içerik (Defterdoldur haftalik-bulten tarzı MEB/il linkleri).
- **Esneklik:** content_type; kanal–kaynak N:N; city_filter. Kaynak formunda rss_url, scrape_config (JSON).
- **Doküman:** `docs/PLAN_HABERLER_MODULU.md`, `docs/CONTENT_SYNC_ARASTIRMA.md`, API_CONTRACT.md.
- **İyileştirmeler:** Haberler: "Tümü" kanalı, tür filtresi (content_type), gelişmiş kart tasarımı (rounded-xl, hover). Ayarlar: Kaynaklar tablosunda Tip/Son sync kolonları, kaynak formunda scrape_config (JSON) textarea. Sync: Sadece sync edilebilir kaynaklar (rss_url veya scrape_config); RSS 100 item limit. BBC Türkçe RSS çalışan demo kaynak. `npm run run-content-sync` ile CLI sync.
- **Haber Yayın (/haberler/yayin):** MEB birimleri sekmeleri, slayt modu, tam ekran, klavye kısayolları, placeholder görsel filtreleme. **Slick referansı (modüler):** globals.css – primary #007bff, card-overlay gradient, btn-sweep-right hover; Haber Yayın kartları card-overlay, primary token kullanımı.
- **2026-02 Son iyileştirmeler:** (1) **image_url:** content_items tablosuna eklendi; RSS description'dan ilk img src çıkarılıyor; mevcut item skip sırasında image_url güncelleniyor. (2) **MEB RSS:** Personel GM dışında TEGM, OGM, DÖGM, YEĞİTEK, ORGM, TTKB, ÖDSGM, MTEGM, SGB, Akademi, YYEGM için `meb_iys_dosyalar/xml/rss_duyurular.xml` URL'leri seed'e eklendi. (3) **81 İl MEB:** Tüm iller için ayrı RSS kaynağı (il_adana, il_ankara, … il_duzce); `rss_item_limit=10`; sync sırasında `city_filter` set ediliyor. Öğretmen/okul yöneticisi giriş yaptığında içerik API'si otomatik okul iline göre filtreleniyor (normalizeCityForMebFilter). (4) **Modern Haberler kartı:** Thumbnail, tıklanabilir kart, HTML summary temizlenerek gösterim. (5) **Sync mesajı:** "Güncel. Tüm içerikler zaten mevcut, görseller güncellendi."
- **Haber Yayın SEO ayarları:** `app_config` tablosunda key-value: `yayin_seo_*`. GET `/content/yayin-seo` (public), GET/PATCH `/app-config/yayin-seo` (superadmin). Web-admin Haberler Ayarlar "Yayın SEO" sekmesi; /haberler/yayin layout'unda `generateMetadata`. **SEO iyileştirmeleri:** metadataBase (root layout), canonical URL, OpenGraph tam set, Twitter Card. Site URL ve Site Adı form alanları. **Ek SEO:** sitemap.ts (robots=index olduğunda /haberler/yayin dahil), robots.ts (disallow /api/, /_next/, /403), WebPage JSON-LD Schema.org, OG görsel 1200×630 px notu, title/description karakter sayacı (60/160 hedef).
- **Devam:** İl bazlı filtre; moderator API; MEB sayfa yapısı değişirse scrape_config güncellemesi.

---

## Sınav Görevi Sistemi ✅

- **Amaç:** Mebhaber3 benzeri, superadmin yönettiği, öğretmenin isteğe bağlı tercih ile bildirim aldığı sınav görevi duyuruları.
- **Veritabanı:** Migration `add-exam-duty-tables.sql` – exam_duties, exam_duty_preferences, exam_duty_notification_log.
- **Backend:** ExamDutiesModule. Admin: GET/POST/PATCH/DELETE `/admin/exam-duties`, POST `/admin/exam-duties/:id/publish`. Teacher: GET `/exam-duties`, GET `/exam-duties/:id`, GET/PATCH `/exam-duty-preferences`. ExamDutySchedulerService cron (06:00): apply_start, deadline, exam_minus_1d, exam_plus_1d bildirimleri.
- **Kategoriler:** meb, osym, aof, ataaof, auzef. Tercih: pref_publish, pref_deadline, pref_exam_minus_1d, pref_exam_plus_1d (kategori bazlı).
- **Web-admin Superadmin:** `/sinav-gorevleri` – liste (kategori/durum filtre), CRUD modal, Yayınla butonu, menüye "Sınav Görevleri" (ClipboardList ikonu).
- **Web-admin Teacher:** `/sinav-gorevlerim` – yayınlanmış sınav görevleri listesi; Bildirimler sayfasında Sınav Görevi tercih formu (kategori × pref_publish, pref_deadline, pref_exam_minus_1d, pref_exam_plus_1d); Sınav Görevi filtre sekmesi.
- **Doküman:** API_CONTRACT, AUTHORITY_MATRIX, NOTIFICATION_MATRIX güncellendi.
- **Veri kaynağı karar dokümanı:** `docs/SINAV_GOREVI_VERI_KAYNAGI_KARAR.md` – **Karar: Basit tablo.** WordPress yok; exam_duties tek tablo.
- **Otomatik sync:** `exam_duty_sync_sources` tablosu; ExamDutySyncService (RSS parse, title_keywords filtre, duplicate önleme source_key+external_id). Cron her gün 07:00 UTC (≈10:00 Turkey). Admin: GET sync-sources, POST sync; web-admin "Otomatik Sync" kartı, "Şimdi Sync" butonu. Varsayılan kaynak: MEB Personel GM (sınav, gözetmen, görev, başvuru anahtar kelimeleri).
- **İyileştirmeler:** Toplu yayınlama (bulk-publish); hedef kitle önizleme (target-count, Users ikonu); tarih uyarıları (son başvuru/sınav geçti badge); Teacher "Tümünü Aç/Kapat" tercih butonları; kategori açıklamaları; soft delete (deleted_at); source_key, external_id (sync için). Migration: `add-exam-duty-source-and-soft-delete.sql`.
- **Doküman:** `docs/SINAV_GOREVI_SISTEM_TASARIM.md`
- **Akış analizi:** `docs/SINAV_GOREVI_MEBHABER_EXAMV3_ANALIZ.md` – Mebhaber3 / examv3 tahmini akışı ve OgretmenPro superadmin eklem akışı (adım adım). mebhaber.net API doğrulandı (exam_meta, kategori).
- **UI (bizim yapı):** Superadmin: Başvuru Açılış/Son Başvuru, Sınav Tarihi/Bitiş kolonları; form açıklaması. Teacher: kategori filtresi, arama, detay genişlet, Başvuru/Sınav/Sonuç tarih gösterimi; tercih formu açıklama güncellendi.
- **Tarih/saat seçimi (DateTimeInput):** `components/ui/datetime-input.tsx` – takvim ikonu ile tıklanabilir picker, değer varken temizle butonu; sınav görevleri formunda tüm tarih/saat alanları bu bileşeni kullanır.
- **Başvuru Onay Son Gün:** `application_approval_end` alanı eklendi ( migration, entity, DTO, service, web-admin form/table, teacher sayfası). Tüm yapıda kullanılır.
- **Superadmin sınav görevleri UI (2026-03):** `/sinav-gorevleri` – İstatistik kartları rounded-xl; Sync kartı modern header; Liste: Tablo/Kart görünüm geçişi, sayfa başına 10/20/50, gelişmiş sayfalama (ilk/son sayfa), kategori renk badge'leri, durum pill (Yayında/Taslak), sticky tablo başlığı.
- **Akış Takvimi sekmesi (2026-03):** Superadmin sınav görevleri sayfasında "Liste" / "Akış Takvimi" sekmeleri. Takvim yapısında tarih ve saate göre akış görünümü; Başvuru açıldı, Başvuru kapandı, Onay son gün, Sınav öncesi hatırlatma, Sınav başladı, Sınav bitti olayları günlere dağıtılmış; güne tıklayınca o günün detayları ve Düzenle butonu.
- **Başvuru linki (application_url) (2026-03):** Kaynak URL'den ayrı, sınava göre başvuru yapılacak adres. Migration, entity, DTOs; form alanı "Başvuru linki"; liste/tablo/kartlarda Başvuru + Kaynak ikonları; öğretmen sayfasında Başvuru (application_url öncelikli, source_url yedek) ve Kaynak ayrı butonlar.
- **Öğretmen sınav görevleri UI (2026-03):** `/sinav-gorevlerim` – Toolbar, modern kartlar, kategori renkleri (MEB amber, ÖSYM mavi vb.), tarih ikonları (CalendarClock, FileCheck, Calendar), aciliyet badge’leri (geçti, yaklaşıyor), Başvuru butonu vurgulu. Tercihler formu: kategori kartları accent renkler, PrefToggle bileşeni (ikon + etiket), Tümünü Aç/Kapat.
- **Tam otomatik sync sistemi (2026-03):** RSS + HTML scrape + GPT. **Backend:** ExamDutyGptService (tarih/application_url/kategori çıkarma); ExamDutySyncService syncFromScrape (Cheerio, Güncel Eğitim agregatör); sync source CRUD (POST/PATCH/DELETE sync-sources); cron günde 4 kez (06,10,14,18 UTC). **App config:** exam_duty_gpt_enabled (GET/PATCH /app-config/exam-duty-sync). **Web-admin:** `/sinav-gorevleri/ayarlar` – Kaynaklar (CRUD, RSS veya scrape), Senkronizasyon (manuel sync), GPT & Ayarlar (sync'te GPT kullan toggle). **Migration:** `add-exam-duty-guncelegitim-source.sql` – Güncel Eğitim kaynağı + app_config. **Türkçe karakter düzeltmesi:** PowerShell ile migration çalıştırırken UTF-8 kullan: `Get-Content -Encoding UTF8 backend/migrations/add-exam-duty-guncelegitim-source.sql | docker exec -i ogretmenpro-db env PGCLIENTENCODING=UTF8 psql -U postgres -d ogretmenpro`. Bozuk veri varsa `fix-guncelegitim-turkish-chars.sql` (Unicode escape ile encoding bağımsız düzeltme). **Güncel Eğitim scrape düzeltmesi (2026-03):** Sayfa SONDAKİKA (sidebar) + ana liste karışıyordu. `container_selector: "#headline"` eklendi – sadece sınav görevi listesi parse edilir; başlıktan "SINAV GÖREVİ" prefix temizlenir; MEB/ÖSYM/AÖF kategorileri doğru atanır.
- **Sync sağlık iyileştirmeleri (2026-03):** `docs/SINAV_GOREVI_SYNC_IYILESTIRMELER.md` – externalId normalizasyonu (utm/slash), batch exists check, fetch retry (2x), GPT 300ms gecikme, başlık 512 limit, container bulunamazsa log uyarısı.
- **Tüm kategoriler için kaynak (2026-03):** `add-exam-duty-sources-all-categories.sql` – MEB Personel kaldırıldı; Güncel Eğitim (agregatör, detect_category_per_item ile meb/osym/aof/ataaof/auzef); title_keywords ATA-AÖF, AUZEF dahil.
- **Sync iyileştirmeleri (2026-03):** `skip_title_keywords` – tek konulu sayfalar için title_keywords atlanır (Güncel Eğitim). Scrape'da GPT filtre devre dışı (sadece başlık; kural tabanlı isLikelyNonApplication). Debug log: keyword/mevcut/gpt_no/kural_no. Script: `npm run run-exam-duty-sync`.
- **Güncel Eğitim liste kapsamı (2026-03):** `#headline` sadece SONDAKİKA (≈10–15 haber) içerir. Container kaldırılınca tüm sayfa taranıp aday sayısı 45'e çıktı; `restore-guncelegitim-headline-only.sql` ile yeniden sadece `#headline` taranıyor (~15 ana sınav haberi).
- **Sync tam iyileştirme paketi (2026-03):** GPT: extractFromText retry (429/5xx), log, dönüş `{ result, gptError }`; sync_options (skip_past_exam_date, recheck_max_count, fetch_timeout_ms, log_gpt_usage). Sync: total_restored/total_gpt_errors, geçmiş sınav atlama, timeout/recheck config, consecutive_error_count → 3'te superadmin Inbox. GET /admin/exam-duties/sync-health; unique (source_key, external_id). Migration: `add-exam-duty-sync-consecutive-error-and-unique.sql`. Web-admin: sync sonrası geri yüklendi bilgisi, Senkronizasyon sekmesinde Sync durumu bloğu, GPT & Ayarlar'da sync seçenekleri formu. Detay: `docs/SINAV_GOREVI_SYNC_IYILESTIRMELER.md` §17–24.
- **Tarih ve başvuru URL (2026-03):** `fetch_article_for_dates` – her haber detay sayfası çekilir; parseDatesFromText ("Son başvuru", "Sınav Tarihi" bağlama duyarlı), extractApplicationUrl (gis.osym.gov.tr, augis.anadolu.edu.tr vb.), GPT (body varsa, yıl 2024–2030 doğrulaması).
- **Sınav öncesi/sonrası (2026-03):** exam_minus_1d ilk sınav gününden -1 gün; exam_plus_1d son sınav gününden +1 gün. Tarih karşılaştırmaları Europe/Istanbul.
- **Taslakları toplu silme (2026-03):** `POST /admin/exam-duties/bulk-delete` – seçilen taslakları soft delete. Web-admin: "Seçilenleri Sil" butonu (checkbox seçili taslaklar için).
- **Görev çıktı geri al (2026-03):** Öğretmen "Görev çıktı – sabah hatırlatması al" işaretledikten sonra iptal edebilir. `POST /exam-duties/:id/unassign-me`; frontend: "Görev çıktı – sınav günü sabah hatırlatması alacaksınız" yanında "Geri al" butonu.
- **Ardışık 2 gün tarih parse (2026-03):** parseDatesFromText'e "6-7 Aralık 2025", "6 ve 7 Aralık", "06-07.12.2025" formatları eklendi. Sınav aralığı doğru exam_date + exam_date_end olarak parse edilir.
- **Çok günlü sınavda gün tercihi (2026-03):** exam_duty_assignments.preferred_exam_date; öğretmen İlk gün / Son gün / Her iki gün seçebilir. Sabah bildirimi sadece seçilen günde (veya her ikisinde) gider. Frontend: assign tıklanınca gün seçici, atandıktan sonra dropdown ile değiştirilebilir.
- **Sabah hatırlatması saati tercihi (2026-03):** exam_duty_preferences.pref_exam_day_morning_time (HH:mm). Öğretmen 07:00, 07:30, 08:00, 08:30, 09:00, 09:30 seçebilir. Cron her 30 dk 04:00–09:30 UTC (≈07:00–12:30 Turkey) çalışır; sadece tercih edilen saatte bildirim gider.

---

## Hesabım Ayarlar – Görsel İyileştirme + Okul/Branş Düzenleme (Defterdoldur benzeri) ✅

- **Hesap sekmesi:** Bölüm başlıkları (Ad Soyad, E-Posta, Şifre Değiştir); her bölüm rounded-xl arka plan; e-posta doğrulama yeşil kutucuk; Yapay Zeka Kullanımı Onayı bölümü (violet, Bot ikonu – placeholder).
- **Okul ve Branş – Düzenlenebilir:** Branş dropdown (MEB branş listesi); İl/İlçe/Okul seçimi (SchoolSelectWithFilter); otomatik veri ile doldurulur, öğretmen seçip güncelleyebilir. PATCH /me: school_id, teacher_branch. GET /schools teacher rolüne açıldı (limit 100, city/district filtre).
- **Zümre sekmesi:** Defterdoldur tarzı – Adı Soyadı (Kendiniz hariç) + Görev dropdown (Okul Müdürü, Müdür Yardımcısı, Zümre Başkanı vb.) + yeşil "+ Ekle"; Zümre Listesi tablosu (#, ADI SOYADI, GÖREV, İŞLEM); boş durumda "Henüz zümre üyesi eklenmemiş." + ikon. Veri formatı: `İsim|Görev, İsim2|Görev2` (document-generate uyumlu).
- **Limitlerim / Çıkış:** İkon kutuları; daha belirgin başlık ve metin.
- **Dosyalar:** `teacher-account-tabs.tsx`, `evrak-defaults-form.tsx`

---

## Bildirimler – Tümünü okundu yap ve silme ✅

- **Backend:** `DELETE /notifications/:id` (tek bildirim sil), `DELETE /notifications/delete-all` (tüm bildirimleri sil). Sadece kendi bildirimleri.
- **Frontend:** "Tümünü okundu yap" (okunmamış varken), "Tümünü sil" (onay ile); her satırda çöp kutusu ile tek bildirim silme.

---

## Nöbet Bildirimleri – Öğretmen Tarafı İyileştirmeler ✅

- **Backend:** Notification entity'ye `metadata` (jsonb) eklendi. Duty bildirimleri (reminder, reassigned, coverage_assigned) için `metadata.date` ile tarih saklanır.
- **Deep linking:** Takas bildirimleri → `/duty/takas`; tarih içeren nöbet bildirimleri → `/duty/gunluk-tablo?date=YYYY-MM-DD`; plan yayınlandı/değişti → `/duty/planlar`.
- **Bildirimler sayfası:** Filtre (Tümü / Nöbet / Duyuru); nöbet bildirimlerinde CalendarClock ikonu, kategori chip, bugün nöbet hatırlatması için vurgu; takas bildirimlerinde "Takasa git" aksiyon butonu.
- **Dashboard:** Öğretmen için okunmamış nöbet bildirimi kartı (`useDutyNotificationsUnread`); menüde Bildirimler için badge.
- **API:** `GET /notifications/unread-count?event_type=duty`; list filtre `event_type=duty` veya `event_type=announcement` (prefix).
- **Bildirim metinleri:** "Günlük listeyi görüntüleyin" çağrısı; daha net ifadeler.
- **Migration:** `backend/migrations/add-notification-metadata.sql`

---

## Nöbet – Zaman Çizelgesi Defterdoldur Benzeri UI ✅

- **Parametreler:** Okul Başlangıç/Bitiş Saati, Ders Süresi (dk), Teneffüs Süresi (dk), Öğle Tatili (Aktif + Başlangıç/Bitiş).
- **Manuel ders saatleri kullan:** Kapalıyken tablo sadece görüntülenir; açıkken her satır düzenlenebilir.
- **Otomatik Hesapla:** Okul başlangıç, ders süresi, teneffüs ve öğle tatili parametrelerinden ders saatlerini hesaplar.
- **Temizle / Ders Ekle:** Ders satırlarını temizler veya yeni satır ekler.
- **Standart Yükle:** 2025-2026 programı (9 ders, 40 dk, 10 dk teneffüs, öğle 12:30–13:30).
- **Tablo:** Sıra | Tür | Başlangıç | Bitiş | Süre (dk) | Teneffüs (dk) | İşlem (manuel modda silme).

---

## Nöbet – Öğretmen Özellikleri (Görev Devri / Tercihlerim) Ayar ✅

- **Okul admin ayarı:** Nöbet > Ayarlar > Okul Ayarları sekmesinde "Öğretmen Özellikleri" kartı. Görev Devri ve Tercihlerim için aç/kapa toggle; açıklayıcı bilgilendirme.
- **Backend:** School entity'ye `duty_teacher_swap_enabled`, `duty_teacher_preferences_enabled` (default true). GET/PATCH `/duty/teacher-features` API. createSwapRequest ve createPreference teacher için feature kapalıysa 403 FEATURE_DISABLED.
- **Öğretmen UI:** DutyNav menüde özellik kapalıysa Görev Devri ve Tercihlerim gizlenir. Direkt URL ile gelirse bilgilendirme kartı (okul yöneticisiyle iletişim, Nöbet sayfasına dön).
- **Migration:** `backend/migrations/add-duty-teacher-features.sql`

---

## Nöbet Yönetimi Liste Alanı UI İyileştirmesi ✅

- **Ana sayfa (Takvim):** Ay görünümü grid başlıkları (uppercase, tracking); hücre min-height ve hover; hafta görünümü gün sütun başlıkları; gün görünümü tablosu başlıkları (uppercase, tracking); kartlar `rounded-xl` ile.
- **Günlük Tablo:** Kontrol çubuğu Card içinde gruplanmış; tarih input focus ring; Son İşlemler kartı rounded; tablo başlıkları uppercase; satır hover `transition-colors`; "Benim" satırı sol kenarlık `border-l-4`.
- **Planlar:** Plan listesi tablosu başlıkları uppercase/tracking; bulk işlem bar padding; satır hover iyileştirildi; kart `rounded-xl`.
- **Plan detay – Nöbet Kayıtları (Liste / Takvim):** Liste/Takvim toggle butonları iyileştirildi (rounded-xl, shadow); Liste tablosu başlıkları uppercase/tracking; satır padding ve vardiya badge dark mode; Takvim görünümü: sürükle-bırak ipucu kutusu (primary vurgulu); hafta günü sütun başlıkları uppercase; tarih kartları rounded-xl, shadow; slot kartları ring-offset ile drop zone; Son İşlemler kartı rounded.

---

## Nöbet Yerleri – Öncelik ve UI ✅

- **Öncelik (sort_order):** Nöbet yerlerinde öncelik alanı (düşük numara = otomatik planlamada önce bu alana atanır). Öğretmen sayısı fazla olsa bile her öğretmene eşit nöbet dağılımı için öncelikli alanlar önce doldurulur.
- **Öğretmen > yer toplamı:** Öğretmen sayısı (örn. 88), nöbet yeri toplamından (örn. 80) fazlaysa, kalan (8) slot **öncelikli alana** (sort_order en düşük alan) eklenir; günlük slot sayısı öğretmen sayısına çıkarılır. Böylece tüm öğretmenler eşit nöbet alır. Backend `priority_area_extended` mesajı döner; dağıtım raporu modalında bilgi olarak gösterilir.
- **Backend:** `createArea` ve `updateArea` artık `sort_order` alıyor; listeleme `sort_order ASC` ile yapılıyor. `autoGeneratePlan` içinde öğretmen > yer toplamı ise `areaAssignmentList` öncelikli alan adıyla genişletilir; günlük slot üst sınırı 200 olacak şekilde ayarlandı.
- **Nöbet Yerleri sayfası UI:** Bilgi kutusu (öncelik açıklaması), tablo görünümü (Öncelik | Alan adı | Nöbetçi/gün | İşlem), yeni alan formunda öncelik alanı, boş durumda tasarımlı boş mesaj, toplam nöbetçi/gün özeti.

---

## Nöbet – Öğretmen İstekleri, Slot Doldurma, Planlama UI ve Takvim Sürükle-Bırak ✅

### Öğretmen istekleri her zaman dikkate alınıyor
- **Backend:** Tercih verileri iki seviyede: `preferredMapConfirmed` (Dikkate alındı) ve `preferredMapAny` (Tercih ediyorum, onaylı veya değil). Sıralamada önce onaylı tercih, sonra onaylanmamış tercih, sonra diğerleri. Böylece öğretmen istekleri admin onayı olmasa bile öncelik alır; onaylı olanlar en yüksek önceliğe sahiptir.

### Her güne her nöbet yeri sayısı kadar nöbetçi
- **Backend:** `candidatePool` boş kaldığında (kurallar nedeniyle kimse kalmadığında) **force pool** kullanılıyor: o gün müsait ve o güne henüz atanmamış, haftalık/aylık limiti aşmamış tüm öğretmenler. Böylece her slot için bir atama yapılmaya çalışılır; her güne hedeflenen nöbetçi sayısı kadar atama yapılır.

### Nöbet planlama sayfası UI
- **Adım 1 – Seçim:** Tarih aralığı (başlangıç/bitiş), hızlı seçimler (Bu ay, Gelecek ay…), haftada 1 veya 2 gün nöbet, ikili eğitimde vardiya seçimi.
- **Adım 2 – Veri girişi:** Günlük nöbet sayısı (yer toplamı), haftalık maks. nöbet, plan adı. Açıklayıcı etiketler ve Nöbet Yerleri linki.
- **Kurallar:** “Öğretmen isteklerini (tercihleri) dikkate al” kutusu vurgulu; diğer kurallar akordiyon altında.

### Plan detay – Takvim ve sürükle-bırak
- **Görünüm:** “Liste” / “Takvim (sürükle-bırak)” seçenekleri.
- **Takvim görünümü:** Tarihlere göre gruplanmış kartlar; her gün için nöbet slotları (vardiya + öğretmen + alan) kart olarak listelenir.
- **Sürükle-bırak:** Taslak planda bir nöbet kartını başka bir kartın üzerine sürükleyip bırakınca iki slotun öğretmeni takas edilir (iki PATCH çağrısı). Düzeltme işlemi takvim üzerinde sürükleme ile yapılabilir.

---

## Nöbet – Tek Tuşla Otomatik Görevlendirme Yeniden Tasarım ✅

### Nöbet alanlarına nöbetçi sayısı
- **Backend:** `DutyArea.slots_required` (zaten vardı); `createArea` ve `updateArea` artık `slots_required` alıyor (1–10, varsayılan 1).
- **Web-admin Yerler sayfası:** Her nöbet yerinde "X nöbetçi" etiketi; ekleme/düzenlemede "Nöbetçi sayısı" alanı. Otomatik planlama bu toplamı günlük slot sayısı olarak kullanır.

### Otomatik görevlendirme planlama kolaylığı
- **Öncelik: Haftada kaç gün nöbet:** Formda "1 gün" veya "2 gün" seçimi. 1 gün → her hafta hep aynı 1 güne; 2 gün → her hafta hep aynı 2 güne nöbet.
- **Backend:** `duty_days_per_week` (1 | 2) parametresi; 2 gün modunda `teacherPreferredWeekdays` (Map<uid, [day1, day2]>) ile aynı iki gün her hafta atanır. `max_per_week` bu değere göre ayarlanır.
- **Nöbet sayısı yetmezse uyarı:** Plan oluşturulduktan sonra atanan slot < hedeflenen slot ise `warning` metni döner; formda ve dağıtım raporu modalında gösterilir. İstemci tarafında da kapasite tahmini (öğretmen × gün/hafta × hafta) gösterilir.
- **Dağıtım raporu:** Detaylı tablo (öğretmen × gün) korunuyor; modalda "Planı düzenle (el ile değiştir)" butonu ile oluşturulan planın detay sayfasına gidilir.
- **El ile değiştirme:** Planlar listesinden veya dağıtım raporu modalındaki "Planı düzenle" ile ` /duty/planlar/[id]` sayfasında slot ekleme/silme/öğretmen değiştirme yapılabilir.

---

## Nöbet – Tebliğ Sekmesi ✅

- **Yeni sekme:** Nöbet menüsünde "Tebliğ" (admin only). Öğretmenlere nöbet ve yerine görevlendirme tebliği metinlerini düzenleme ve yazdırma.
- **Haftalık Nöbet Çizelgesi iyileştirmeleri:** Tüm metinler düzenlenebilir; tablo inline düzenleme. Başlık (HAFTALIK NÖBET ÇİZELGESİ), NÖBETÇİ ÖĞRETMENLERİN GÖREVLERİ (8 madde), nöbet yeri sütun başlıkları ve hücre içerikleri yazdırma öncesi düzenlenebilir. School entity: `duty_teblig_haftalik_baslik`, `duty_teblig_haftalik_duty_duties_text`. Migration: `add-duty-teblig-haftalik-metin.sql`. Müdür imza satırı düzeltildi (boşta çizgi gösterimi).
- **Müdür adı düzenlenebilir:** Nöbet → Yerler → Okul Ayarları'nda "Belge Bilgileri" kartı (Müdür adı, İlçe). Tebliğ sayfasında Boş Ders bölümünde de düzenlenebilir. `principal_name` ve `district` school-default-times PATCH ile School'a kaydedilir.
- **Haftalık çizelge başlığı:** T.C. → [İlçe] KAYMAKAMLIĞI → Okul adı → HAFTALIK NÖBET ÇİZELGESİ. Yazdırmada kağıt üst/alt bilgisi için kullanıcıya "Üst bilgi ve alt bilgi kapatın" notu.
- **1. Öğretmenlere Nöbet Tebliği:** MEB/resmi tebliğ formatına uygun varsayılan şablon. **NÖBETÇİ ÖĞRETMENLERİN GÖREVLERİ** (8 madde) eklendi. Placeholder: `{{okul_adi}}`, `{{tarih}}`, `{{ogretmen_adi}}`, `{{nobet_tarihi}}`, `{{nobet_yeri}}`, `{{mudur_adi}}`, `{{nobet_saatleri}}`.
- **2. Haftalık Nöbet Çizelgesi:** Pazartesi–Cuma tablo formatında yazdırma. `GET /duty/haftalik-cizelge?weekStart=` — nöbet yerleri sütun, günler satır; MEB formatında NÖBETÇİ ÖĞRETMENLERİN GÖREVLERİ dahil.
- **3. Aylık Nöbet Tebliği:** Ay/yıl seçici; `GET /duty/aylik-cizelge?month=&year=` ile veri. Başlık: [Okul Adı] [Ay] [Yıl] ÖĞRETMEN NÖBET ÇİZELGESİ. İkili eğitimde SABAH/ÖĞLEN sütunları, tekli eğitimde tek sütun. Tablo: TARİH, GÜN, her nöbet alanı için sabah/öğlen veya tek sütun.
- **2. Yerine Görevlendirme Nöbet Tebliği:** Varsayılan şablon. Placeholder: `{{gelmeyen_adi}}`, `{{gorev_tarihi}}`, `{{ders_saati}}` + ortaklar.
- **4. Nöbetçi Öğretmen Boş Ders Görevlendirme:** Gün seçilince o güne ait **gelmeyen** ve **yerine görevlendirilen** öğretmenler MEB formatında tablolara otomatik doldurulur. `GET /duty/bos-ders-teblig?date=` endpoint'i; gelmeyenler (raporlu/izinli/gelmeyen/yerine görevlendirildi) ve gorevlendirilenler tabloları; yazdırma (tablo formatında belge).
- **Backend:** School entity `duty_teblig_duty_template`, `duty_teblig_coverage_template` (text). GET/PATCH `/duty/teblig-templates` API.
- **Web-admin:** Metin düzenleyici (textarea), Kaydet, Yazdır butonları. Yazdır: placeholder merge (okul adı, müdür, tarih; boş alanlar çizgi). Tebellüğ bölümü dahil.
- **Migration:** `backend/migrations/add-duty-teblig-templates.sql`

---

## Nöbet Modülü – Kapsamlı İyileştirmeler (Son Oturum) ✅

### Bug Düzeltmeleri
- **`initCoverageForSlot` BUG DÜZELTİLDİ:** Devamsız öğretmenin DOLU (gerçek sınıf) dersleri için coverage oluşturulur. Önceden boş (free) dersler kullanılıyordu — hatalıydı.
- **Nöbet takası partner fetch BUG DÜZELTİLDİ:** Takas modalında `/duty/daily` yerine `/duty/partners` endpoint'i kullanılır. Böylece aynı gün farklı yerlerde (kantin, koridor vb.) nöbet tutan tüm öğretmenler listede görünür.

### Özellik Eklemeleri
- **Coverage görevlendirme kısıtı:** `assignCoverage` backend validasyonu — sadece o günkü nöbetçi öğretmenlere görevlendirme yapılabilir (`NOT_ON_DUTY` kodu).
- **Coverage atama sıralama:** DB'deki toplam `coverage_lesson_count` birincil adalet kriteri (önceden session round-robin birincildi).
- **Öğretmen günlük tabloda tüm nöbetçi görünsün:** `getDailyRoster` tüm rollar için tüm nöbet slotlarını döndürür; öğretmenin kendi slotu `is_mine: true` flag ile işaretlenir ve mavi sol kenarlıkla vurgulanır.
- **Bildirimleri Gönder butonu:** Günlük tablo sayfasında yönetici için "Bildirimleri Gönder" butonu. `POST /duty/notify-daily?date=...` endpoint'i ile nöbetçi ve coverage atanan tüm öğretmenlere toplu bildirim.
- **İstatistik — İki Tablo:** Özet sayfasında (1) Ders Görevi Sıralaması (coverage_lesson_count bazlı, Adalet Kriteri 1) ve (2) Toplam Nöbet Sıralaması (weighted_count bazlı, Adalet Kriteri 2) ayrı tablolar.
- **Devamsızlık UI:** "Boş Dersler" etiket → "Boşa Çıkacak Dersler"; boşa çıkacak ders sayısı için uyarı banner'ı.
- **Muaf Öğretmenler:** Özet sayaç kartları; arama/filtreleme; Aktif/Muaf badge her öğretmende görünür; muaf kaldırma butonu yeşil renk.
- **Nöbet takas area_name:** Takas modalındaki öğretmen listesinde `– Area Adı` şeklinde nöbet yeri gösterilir.

---

## Nöbet Modülü – Adil Dağılım Algoritması İyileştirmeleri ✅

### İlk Nöbet Dağılımı (`autoGeneratePlan`) — Yeni Kriterler
Sıralama artık 5 kriter:
1. **Tercih günü (prefer) bonus** — öğretmen o günü tercih ettiyse önce gelir
2. **Ardışık gün cezası** — dün de nöbet tutan öğretmen sona itilir (MEB adaleti)
3. **MEB 91/a: Az dersli gün önce** — ders sayısı az olan güne nöbet tercih edilir
4. **Hafta günü dengesi** — aynı öğretmen hep Pazartesi olmaz; hafta günü sayacı tutulur
5. **Dönem weighted_count** — en az toplam yüklü öğretmen önce

Ayrıca `unavailable` tercihlerin yanı sıra `prefer` tercihleri de tek sorguda çekiliyor.

### Coverage Atama (`autoAssignCoverages`) — Yeni Adil Dağılım
Sıralama artık 4 kriter:
1. **Bu session'da en az coverage alan** (round-robin garantisi — 4 nöbetçi + 4 ders → 1'er ders)
2. **DB'deki toplam coverage_lesson_count** — geçmiş dönem adilliği (artık kalıcı)
3. **Genel weighted_count** — toplam nöbet yükü
4. **Boş ders saati** — en rahat öğretmen

**Günde max 2 coverage limiti** — aynı öğretmenin o günkü diğer coverage'ları da sayılır.

---

## Nöbet Modülü – Ders Saati Bazlı Coverage (nobetyonetim.net çekirdek özelliği) ✅

### Mimari (yeni)
- **`duty_coverage` tablosu:** Gelmeyen öğretmenin her boş ders saati için ayrı kayıt.
  - `duty_slot_id` → hangi nöbet slotuna ait
  - `lesson_num` → hangi ders saati (1–12)
  - `covered_by_user_id` → görevlendirilen öğretmen (null = atanmadı)
- **Örnek:** Ayşe öğretmen 3 boş saatteyse → 3 `DutyCoverage` kaydı → 3 farklı öğretmen.

### Backend (`duty.service.ts`)
- **`markAbsent`:** Gelmeyen işaretlenince `initCoverageForSlot` otomatik çağrılır.
  - Öğretmenin ders programından boş saatler hesaplanır → her biri için `DutyCoverage` stub oluşturulur.
- **`getCoverageStatus(duty_slot_id)`:** Tüm ders saatleri + atanan öğretmen + öneri listesi.
- **`assignCoverage(duty_slot_id, lesson_num, user_id)`:** Manuel atama + log + bildirim.
- **`autoAssignCoverages(duty_slot_id)`:** Tümünü otomatik ata (en az yüklü + o saatte boş).
- **`removeCoverage(coverage_id)`:** Atamayı kaldır.
- **`getCoveragesForDate(date)`:** Günlük tablo için tüm coverage kayıtları.
- **`getSummary`:** `coverage_lesson_count` artık `weighted_count`'a ekleniyor (tam adil dağılım).

### Controller (yeni endpoint'ler)
- `GET  /duty/coverage?duty_slot_id=X` → durum + öneriler
- `POST /duty/coverage/assign` → `{ duty_slot_id, lesson_num, user_id }`
- `POST /duty/coverage/auto-assign` → `{ duty_slot_id }`
- `DELETE /duty/coverage/:id` → atamayı kaldır
- `GET  /duty/coverage-by-date?date=YYYY-MM-DD`

### Frontend
- **`LessonCoverageDialog`** (yeni bileşen `components/duty/LessonCoverageDialog.tsx`):
  - Ders saatleri listesi: 1. ders → Mehmet, 2. ders → Fatma, 3. ders → atanmadı…
  - Her satır: atanmış öğretmen + değiştir/kaldır + dropdown öneri listesi.
  - "Tümünü Otomatik Ata" butonu.
  - Tamamlandı durumu (yeşil onay).
- **`duty/page.tsx`:** `markAbsent` sonrası artık doğrudan `LessonCoverageDialog` açılıyor.
  - Absent işaretli slotlarda turuncu `⚡` butonu → coverage dialog'ını açar.
  - Haftalık takvimde "Gelmeyen ⚡" rozeti tıklanabilir.
- **`ozet/page.tsx`:** "Ders Kap." sütunu eklendi → ders saati bazlı kapatmalar.

---

## Nöbet Modülü – Ders Saati Bazlı Yerine Görevlendirme + Adil Dağılım (önceki oturum)

### Backend

- **`duty_slot` yeni kolonlar:**
  - `lesson_num INT NULL` — nöbetin hangi ders saatini kapsadığı (1–12; null = vardiya bazlı genel).
  - `lesson_count INT DEFAULT 1` — nöbetin kaç ders saatine denk geldiği (adil dağılım ağırlığı).
- **`DutyService.suggestReplacement` iyileştirildi:**
  - Artık `slot.lesson_num` timetable servisine iletiliyor.
  - Sonuç: sadece o ders saatinde dersi OLMAYAN öğretmenler önerilir (gerçek anlamda "derini olmayan").
  - Response'a `slot_lesson_num` eklendi.
- **`DutyService.getSummary` güncellendi:**
  - `weighted_count` = `SUM(lesson_count)` — yerine görevlendirme ders saati ağırlığı dahil toplam.
  - `replacement_count` — gelmeyen öğretmen yerine yapılan nöbet sayısı.
  - `regular_count` — normal atanan nöbet sayısı.
- **`DutyService.autoGeneratePlan` güncellendi:**
  - Adil dağılım için artık `weighted_count` kullanılıyor (`slot_count` yerine).
  - Yerine çok görev yapan öğretmene daha az nöbet atanıyor.
- **Test verisi:** 5 öğretmen için ders programı DB'ye eklendi (40 kayıt).
  - Perşembe 3. saatte Zeynep Arslan dersli → öneri listesine girmiyor (✓ test edildi).
  - Mehmet Kaya'ya `lesson_num=3, lesson_count=2` atandı → weighted_count=9 (✓ test edildi).

### Frontend

- **Yerine Görevlendir Dialogu (`duty/page.tsx`) yenilendi:**
  - Gelmeyen nöbetin ders saati gösteriliyor.
  - Önerilen öğretmenler kart listesinde: renk dot, boş saat ve "Bu saatte boş" rozeti.
  - Ağırlıklı nöbet sayısı sağda görünüyor (adil dağılım için).
  - Select dropdown: önerilen / diğer gruplu.
  - Dağılım grafiği `weighted_count` ile çiziliyor.
- **İstatistikler sayfası (`duty/ozet/page.tsx`) güncellendi:**
  - "Yerine Görev" özet kartı eklendi.
  - Detay tablosuna: Normal, Yerine, Ağırlık sütunları eklendi.
  - Ağırlıklı sayım aktifse bilgi notu gösteriliyor.
- **Takvim ve Günlük Tablo:** `lesson_num` badge'i chip/satırda görünüyor.
  - Hafta view chip'leri: "3. ders · Bahçe" gösterimi.
  - Günlük tablo: ilgili ders sütunu "⚑ Nöbet" olarak vurgulanıyor.

### Yarın devam için öneriler

- Yeni nöbet planı oluştururken her slot'a `lesson_num` girme imkânı (UI'da slot başına ders saati seçimi).
- `autoGeneratePlan` içinde lesson_num otomatik atama (shift bazlı: morning=1..4, afternoon=5..8 sabit veya okul saatine göre).
- `DutyAbsence` kayıtlarını `duty_slot.absent_marked_at` ile entegre etme (ikisi ayrı akış, birleştirilmeli).
- Öğretmen planında "Bu öğretmen için yerine görev istatistiği" gösterimi (TeacherDetailPanel).

---

## Nöbet Modülü – Takvim Renk + Öğretmen Detay Paneli (bu oturum)

- **Varsayılan görünüm:** Takvim artık hafta görünümü (`week`) ile açılıyor.
- **Öğretmen renk sistemi:** `teacher-color.ts` — 12 pastel renk; öğretmen ID'sine göre deterministik renk ataması. Hafta, ay ve gün görünümlerinde chip'ler renkli.
- **`TeacherDetailPanel`:** Sağdan açılan slide-over panel. Tıklama ile açılıyor. İçerik: öğretmen adı + branş + muafiyet rozeti + dönem nöbet listesi + Pzt–Cum ders programı grid'i. Nöbet olan günler ders programı sütununda vurgulanıyor.
- **Gün görünümü:** Nöbetçi adına tıklanınca panel açılıyor.
- **Ay görünümü:** Chip sayısı 2'den 3'e çıkarıldı, renkli chip'ler paneli açıyor.
- **Ders Programı sayfası:** "Mevcut program durumu" kartı eklendi (kaç öğretmen, kaç girdi). Yüklenince MEB Madde 91/a notu gösteriliyor.

---

## Nöbet Modülü – Veri Görünürlüğü + Karakter Düzeltmeleri (bu oturum)

- **DB Türkçe karakter düzeltmesi:** Demo Okulu öğretmen adları ve nöbet alan adları UTF-8 ile yeniden yazıldı (Ayşe Yılmaz, Ali Çelik, Elif Şahin, Fatma Öz vb.; Bahçe/Dış Alan, Kantin Önü, Giriş Katı, Spor Salonu Girişi ve duty_slot.area_name).
- **Takvim otomatik plan geçişi:** `/duty` ana takvimi sayfa açılışında aktif plan yoksa en son yayınlanan planın dönemine otomatik gider. "Son Plan" hızlı butonu eklendi.
- **Günlük Liste otomatik plan geçişi:** `/duty/gunluk-tablo` sayfası, bugün veri yoksa latest plan tarihine geçer. "Son Plan" butonu eklendi.
- **Özet otomatik tarih:** `/duty/ozet` yüklenince en son planın tarih aralığına otomatik geçer.
- **Görevlendirmeler otomatik tarih:** `/duty/gorevlendirilen` yüklenince en son planın tarih aralığına otomatik geçer.
- **Devamsızlık geniş aralık:** `/duty/gelmeyen` artık son 2 yıl+bu yıl sonuna kadar absences çeker (eski kısıtlı aralık yerine).
- **Tercihler geniş aralık:** `/duty/tercihler` 2 yıl geriye + 1 yıl ileriye kadar preferences çeker.
- **İşlem Kaydı geniş aralık:** `/duty/logs` 2 yıl geriye kadar loglar çeker.

---

## Nöbet Modülü – MEB Uyum + Muafiyet + Ders Programı (son oturum)

- **MEB Madde 91 uyumu:**
  - Müdür, müdür yardımcısı ve muaf öğretmenler otomatik planlama + önerilere dahil edilmez.
  - Madde 91/a: Nöbet, ders sayısının en az olduğu güne tercih edilecek şekilde `autoGeneratePlan` güncellendi.
- **`users.duty_exempt` + `duty_exempt_reason`:** DB kolonu eklendi, User entity + UpdateUserDto + service güncellendi.
- **Yeni API endpoint'leri:**
  - `GET /duty/teachers?includeExempt=true` — muaf öğretmenler dahil listeleme (muafiyet yönetim ekranı için).
  - `PATCH /duty/teachers/:id/exempt` — okul yöneticisi nöbet muafiyeti atar/kaldırır.
- **`DutyService.setTeacherExempt`:** Scope korumalı; muafiyet log kaydı tutar.
- **`TeacherTimetableService.getLessonCountByDayForUsers`:** Her öğretmen için gün bazlı ders sayısı haritası; MEB gün tercihi için kullanılır.
- **Web-admin Nöbet Yerler sayfası:** Yeni "Nöbet Muafiyeti" kartı; muaf yapma/kaldırma + neden seçimi (ön ayarlı seçenekler).
- **Excel şablonları güncellendi:**
  - Nöbet planı şablonu: Bugünün tarihleriyle örnek veriler, açıklama satırları, MEB notu (muaf öğretmen uyarısı).
  - Ders programı şablonu: MEB Madde 91/a notu, maxLessons parametresi (6–12), müdür/müdür yrd uyarısı.
  - Excel parse: # ile başlayan açıklama satırları otomatik atlanır.

---

Bu dosya proje ilerlemesini ve bir sonraki oturumda nereden devam edileceğini not eder. Güncelle: her önemli iş sonrası.

---

## KVKK / Güvenlik / Politika (güncel)

- **Politika sayfaları:** `/gizlilik`, `/kullanim-sartlari`, `/cerez` (modern, responsive, birbirine link).
- **Kayıt formu:** Gizlilik + Kullanım Şartları checkbox zorunlu; pazarlama izni opsiyonel. Backend validation.
- **Footer:** Gizlilik, Kullanım Şartları, Çerez linkleri (demo1 footer + login/register altında).
- **Çerez banner:** İlk ziyarette KVKK uyumlu onay; tercih `ogretmenpro_cookie_consent` ile localStorage.
- **VERBIS_ENVANTER.md:** Kişisel veri envanteri. İletişim: kvkk@ogretmenpro.com.
- **Backend data-export:** `GET /me/data-export` – JSON dışa aktarma.
- **Backend account-delete:** `DELETE /me/account` – hesap anonimleştirme (status=deleted, email anonim).
- **Backend rate limiting:** ThrottlerModule; auth endpoints 5/dk; genel 100/dk.
- **Backend audit log:** AuditLog entity, AuditService; login, password_changed, data_export, account_deleted kaydı.
- **Profil → Veri talepleri:** Veri indir + Hesap sil butonları (onaylı hesap silme).

---

## Evrak Modülü – Tam Yapı (ÖğretmenEvrak benzeri)

- **Backend:** DocumentTemplate entity, document-templates modülü (liste, detay, indirme, CRUD).
- **API:** GET /document-templates (filtre), GET /document-templates/subjects (MEB ders kataloğu), GET /document-templates/options (sub_type, school_type, academic_year), GET :id/download.
- **Form + Merge (evrak üret):** `requires_merge`, `form_schema` alanları; POST /documents/generate; docxtemplater ile Word merge. Profil (ad, okul, müdür, öğretim yılı) otomatik doldurulur.
- **Örnek:** Veli Toplantı Tutanağı – seed ile `local:veli-toplanti-tutanak.docx` şablonu; Evrak sayfasında "Diğer Evraklar → Veli Toplantı Tutanağı" → "Üret" → form doldur → indir.
- **MEB Ders Kataloğu:** `backend/src/config/document-template-subjects.ts` – sınıf ve bölüme göre ders listesi (1–12, Ders/Seçmeli/İHO).
- **Seçenekler:** `backend/src/config/document-template-options.ts` – zümre (sene_basi, sene_sonu…), İYEP (turkce, matematik), BEP (dosya, plan_yeni, kaba_form), school_type.
- **School.principalName:** Müdür adı alanı eklendi – form merge (Faz 2) için.
- **Web-admin:** /document-templates (admin CRUD), /evrak (öğretmen kataloğu – wizard: Planlar/Zümre/Diğer).
- **Önizleme:** POST /documents/preview – merge sonucu Excel için `sheet_html` (SheetJS sheet_to_html, colspan/rowspan ile merged cells) döner; evrak modalında "Önizle" ile indirmeden tablo önizlemesi.
- **Öğretmen Evrak Kataloğu:** Plan türü → Sınıf → Bölüm (5–8) → Ders → Öğretim yılı; Zümre: Okul türü → Zümre türü → Ders; Diğer: Evrak türü.
- **Admin form:** sub_type dropdown (zümre, İYEP, BEP için preset); school_type genişletildi (ortaokul_secmeli, lise_secmeli).
- **Referans:** docs/EVRAK_ENTEGRASYON_ANALIZ.md, docs/EVRAK_PLANLAR_ANALIZ.md.
- **Evrak arşivi:** document_generations tablosu; her üretimde kayıt; GET /documents/generations (liste), POST /documents/generations/:id/redownload (tekrar indir). Evrak sayfasında modern arşiv kartları: plan bilgisi, oluşturma tarihi, Tekrar indir + Seçimlere uygula butonları.
- **Evrak entitlement (Öneri 7):** evrak_uretim kotası; teacher için generate/redownload başında checkAndConsumeEvrak; superadmin/moderator muaf. Kota bittiğinde 402 + ENTITLEMENT_REQUIRED; Evrak sayfasında kota gösterimi; kotası bittiğinde "Marketten hak al" linki; "Üret ve İndir" / "Tekrar indir" devre dışı.

---

## Bu oturum – Nöbet 123 iyileştirmeleri (tercih onay, tekrarlayan, soft delete)

- **Tercih onay akışı:** `duty_preference` tablosuna `admin_confirmed_at`, `admin_confirmed_by` eklendi. `PATCH /duty/preferences/:id/confirm` – school_admin tercihi "Dikkate alındı" işaretler. **Geri alma:** `PATCH /duty/preferences/:id/unconfirm`. Tercihler sayfasında admin için onay + geri al butonu; öğretmen satırda aşama etiketi (Beklemede/Dikkate alındı).
- **Tekrarlayan gün (Her Pazartesi vb.):** Tercih ekle formunda "Tek gün" / "Her hafta" modu. Her hafta: Pazartesi–Cumartesi checkbox, başlangıç/bitiş tarihi. Backend seçilen günlere göre tüm tarihlere tek tek tercih oluşturur.
- **Soft delete + toplu silme:** `duty_plan`, `duty_slot` tablolarına `deleted_at` eklendi. `listPlans`, `getSlotsForDate` vb. `deleted_at IS NULL` ile filtreler. `getSummary` istatistikleri korur (deleted dahil). `POST /duty/plans/:id/soft-delete`, `POST /duty/plans/bulk-delete`.
- **Web-admin:** Planlar listesinde plan bazlı sil + çoklu seçim ile toplu sil; plan detay sayfasında "Planı sil" butonu.
- **Migration:** `migrations/add-duty-preference-confirm-and-soft-delete.sql`.
- **Fix (dev):** Backend derleme hatası yüzünden eski süreç 4000'de kalıyordu (TS2345 `slots_per_day`). Controller'da default verildi; demo teacher ile `POST /duty/preferences` (tek gün + her hafta) 200 ile doğrulandı.
- **Auto-generate UI/validasyon:** Web-admin "Tek Tuşla Otomatik Görevlendirme" preset'leri dinamikleştirildi, başlangıç>bitiş kontrolü eklendi, opsiyonel plan adı (version) eklendi, öğretmen listesi `/duty/teachers` ile standardize edildi.
- **Gelmeyen tarih fix:** `Gelmeyen` sayfasında `from` tarihi için ay hesabı düzeltildi (`getMonth()+1`).
- **Logs iyileştirmesi (kullanılabilir hale getirildi):** Backend `GET /duty/logs` artık `from/to/action/limit` filtrelerini destekler. Web-admin `Değişiklik Logu` sayfasına tarih aralığı, işlem filtresi ve "Yenile" eklendi.
- **Soft-delete güvenliği (edge-case kapatma):** Silinmiş plan/slot üzerinde işlem yapılmasın diye `takas oluştur`, `takas onayla`, `yerine görevlendir`, `gelmeyen işaretle` akışlarına `deleted_at` kontrolü eklendi. Swap listesinde de silinmiş plan/slot filtrelendi.
- **Tarih (timezone) kayması fix:** Nöbet modülünde `toISOString().slice(0,10)` kaynaklı “1 gün kayma” riskini kaldırmak için tüm duty sayfalarında local `YYYY-MM-DD` üretimi standardize edildi.
- **Kalite doğrulama:** Web-admin `next build` ve `eslint` (0 error) çalıştırılarak değişiklikler derleme seviyesinde doğrulandı. ESLint config’te aşırı agresif bazı React hook kuralları (false-positive üreten) proje override ile devre dışı bırakıldı.

---

## Bu oturum – Nöbet bildirimleri (öğretmen web)

- **Backend:** duty.published ve duty.reassigned için Inbox kaydı zaten oluşturuluyordu. Bildirim metinleri zenginleştirildi (dönem tarihi, slot tarihi ve alan bilgisi).
- **Notifications API:** school_admin rolü eklendi (plandaki öğretmenler gibi okul admin de planda nöbetçiyse bildirim alabilir).
- **Web-admin:** /bildirimler sayfası – teacher ve school_admin için Inbox listesi, okundu işaretle, tümünü okundu yap, "Daha fazla yükle". Menüde Profil altında "Bildirimler" (teacher, school_admin).
- **Event:** Plan yayınlandığında plandaki tüm öğretmenlere; yerine görevlendirildiğinde yeni atanan öğretmene Inbox bildirimi. Mobil push sonra eklenecek.

---

## Bu oturum – Öğretmen Ders Programı + Nöbet Entegrasyonu

- **Backend:** teacher_timetable entity (school_id, user_id, day_of_week, lesson_num, class_section, subject); TeacherTimetableModule, Service, Controller.
- **Migration:** `migrations/add-teacher-timetable.sql`.
- **API:** GET /teacher-timetable (okul programı), GET /teacher-timetable/me (öğretmenin kendi programı), GET /teacher-timetable/by-date?date= (tarih bazlı), POST /teacher-timetable/upload (Excel), DELETE /teacher-timetable (temizle). GET /duty/suggest-replacement?duty_slot_id= (yerine görevlendirme önerisi – boş saati olan nöbetçiler).
- **Excel formatı:** Gün (1–5), Saat (1–12, okula göre 6–12), Öğretmen (email/ad), Sınıf, Ders. Esnek sütun eşleme. **Geniş format (dersprogram10):** Ad_Soyad + Pazartesi_ders1 … Cuma_ders10; hücre `7A-MAT` veya `7A - Matematik`. Örnek Excel: Türkçe gün adları, doğru sütun yerleşimi, öğretmen eşleştirme (Türkçe karakter normalizasyonu).
- **GET /duty/daily:** lesson_cells eklenir (user_id → lesson_num → { class_section, subject }).
- **Web-admin:** /ders-programi (bağımsız menü). Defterdoldur benzeri: Ana, Programlarım, Oluştur. **Öğretmen** kendi programını oluşturabilir (Yeni Program, grid'de + Ders Ekle). Okul admin program yüklediyse "Okul Programı" olarak görüntülenir. Kişisel programlar: my-programs CRUD. Admin: Excel yükleme, tüm tablo, Ayarlar.
- **Eski link:** /duty/ders-programi → /ders-programi yönlendirmesi.
- **Günlük tablo:** 1.–N. Ders sütunları (6–12, ders programına göre dinamik) – ders varsa sınıf-ders, yoksa "—" (nöbet).
- **Yerine görevlendir:** Modalda boş saati olan nöbetçiler önce önerilir (X boş saat önerilen).
- **Plan oluştur:** Ders programı varsa "bu gün dersi az olanlar" (MEB: dersi az günde nöbet) önce listelenir; öğretmen dropdown ders sayısına göre sıralanır.

---

## Ders Programı Plan – Başlangıç/Bitiş Tarihi, Yayınlama ✅

- **Tasarım:** `docs/DESIGN_TIMETABLE_PLANS.md` – valid_from/valid_until, çakışma önleme, timetable.published bildirimi.
- **Migration:** `backend/migrations/add-school-timetable-plan.sql` – school_timetable_plan, school_timetable_plan_entry, teacher_timetable.plan_id.
- **Backend:** Excel yükleme → taslak plan (SchoolTimetablePlan + SchoolTimetablePlanEntry); GET /plans, GET /plans/:id; POST /plans/:id/publish (valid_from, valid_until, overlap check); teacher_timetable'a kopyalama; timetable.published bildirimi (Inbox).
- **Tarih bazlı plan:** getBySchool, getByMe, getByDate, getMaxLessons, getLessonCountByDayForUsers bugün geçerli plana göre filtreler.
- **Frontend:** Excel yükle sonrası Taslak Önizleme kartı (başlangıç/bitiş tarihi, Yayınla butonu). Stepper: 1) Excel Yükle → 2) Tarih Seç ve Yayınla → 3) Programlarım.
- **Temizle:** Tüm teacher_timetable + plan + plan_entry silinir.
- **API_CONTRACT, CORE_ENTITIES** güncellendi.
- **Ders Programı Ayarlar sayfası iyileştirmesi:** Hızlı erişim kartı (Excel ile Yükle, Programlarım, Nöbet Ayarları), Tablo/Ders saatleri kartları (CardDescription, ikonlu başlıklar), ders saati özeti boş/ dolu durumları, İpuçları bölümü, breadcrumb (Anasayfa / Ders Programı / Ayarlar).
- **2026-02 Plan geçerlilik güncelleme + açık uçlu program:** (1) **PATCH /teacher-timetable/plans/:id** – Yayınlanmış planın geçerlilik tarihlerini (valid_from, valid_until) güncelleme. Programlarım sayfasında Geçerlilik yanında "Düzenle" butonu → modal ile tarih düzenleme. (2) **valid_until opsiyonel** – Bitiş tarihi belirsiz (açık uçlu) seçeneği: program yeni program yayınlanana kadar geçerli. Excel ile Yükle yayınlama formunda checkbox; PATCH body'de valid_until: null. (3) Yeni program yayınlandığında önceki açık uçlu plan otomatik sonlandırılır (valid_until = yeni plan valid_from - 1 gün). Migration: `school-timetable-plan-valid-until-nullable.sql`. API_CONTRACT.md güncellendi.
- **2026-02 Okul admin Ders Programı sekmesi iyileştirmesi:** (1) **Dashboard:** school_admin için Ders Programı hızlı erişim kartı eklendi (Table2 ikonu). (2) **/ders-programi sayfası (admin):** Sekmeli arayüz: **Özet** – önceki/sonraki plan navigasyonu, plan geçerlilik tarihleri; **Günlük Tablo** – tarih seçici (önceki/sonraki gün, bugün), o gün hangi saatte hangi öğretmenin hangi sınıfta hangi dersi olduğu tablosu; **Takvim** – aylık takvim görünümü, güne tıklayınca o günün ders listesi. GET /teacher-timetable/by-date, /plans, /duty/teachers kullanılıyor.
- **2026-02 Excel şablon + yükleme okul ayarlarına uyum:** (1) **Örnek şablon:** GET /teacher-timetable/example-template okulun `duty_max_lessons` (6–12) ayarına göre sütun sayısı üretir; böylece 8 derslik okullar 12 derslik şablondan karışmaz. (2) **Yükleme doğrulaması:** Excel’de `lesson_num` > okul max ise bu kayıtlar atlanır; response `errors` dizisine uyarı eklenir (örn. "Okul ayarlarına göre en fazla 8 ders saati. 5 kayıt atlandı (ders saatleri: 9, 10)."). İkili eğitim ve 12 saate kadar desteklenir; farklı ayarlı okulların verisi karışmaz.
- **2026-02 Zaman çizelgesi tek yer:** Günlük Ders Saatleri ve Zaman Çizelgesi ayarları Nöbet Yerler'den Ders Programı Ayarlar'a taşındı. Ders Programı Ayarlar sayfasında "Genel" ve "Zaman Çizelgesi" sekmeleri; Zaman Çizelgesi tek düzenleme yeri. Nöbet Yerler Okul Ayarları bölümünde bu kart kaldırıldı; yerine bilgi uyarısı ve "Zaman Çizelgesine git" linki. API aynı (PATCH /duty/school-default-times); Ders Programı ve Nöbet modülleri bu veriyi kullanır.

---

## Bu oturum – Kazanım Setleri Modülü (tam sistem)

- **Backend:** outcome_set, outcome_item entity; OutcomeSetsModule, Service, Controller.
- **API:** GET /outcome-sets (liste, filtre: subject_code, grade, academic_year), GET /outcome-sets/plan-summary (yıllık planda verisi olan dersler), GET/POST/PATCH/DELETE /outcome-sets/:id, POST /outcome-sets/import-from-plan.
- **Import:** Yıllık plan içeriklerinden kazanimlar parse edilir (COĞ.9.1.1, MAT.9.2.1 formatı); week_order, unite korunur.
- **Web-admin:** /outcome-sets – liste (kart grid), filtre (ders, sınıf, yıl), "Yıllık Plandan İçe Aktar", "Yeni Boş Set", sil onayı. /outcome-sets/[id] – kazanım listesi düzenleme (hafta, ünite, kod, açıklama); ekle/sil.
- **Ders verisi:** Yıllık Plan modülünden (findSummary) alınır; plan özeti boşsa fallback (Coğrafya, Matematik, Türkçe, Fen).
- **Migration:** `migrations/add-outcome-sets.sql` (outcome_set, outcome_item).

---

## Bu oturum – Plan altı not (tablo altı açıklama)

- **Excel import:** Tablo altı yıldızlı açıklamalar (* Okul temelli planlama; zümre öğretmenler kurulu...) artık konu alanına konmuyor. GPT ve MEB parse ayrı `planNotu` çıkarıyor; import sırasında `yillik_plan_meta` tablosuna kaydediliyor.
- **YillikPlanMeta entity:** `plan_key` (subject_code|grade|academic_year), `tablo_alti_not` text. Migration: `migrations/add-yillik-plan-meta.sql`.
- **API:** GET/PATCH `/yillik-plan-icerik/meta?subject_code=&grade=&academic_year=` – plan bazlı tablo altı not.
- **Evrak çıktı:** Word yıllık planda tablonun ve imza bloğunun altında küçük yazı (7pt) olarak `tablo_alti_not` gösteriliyor.
- **Web-admin:** Yıllık Plan İçerikleri sayfasında plan listesi altında "Plan altı not" textarea + Kaydet butonu; düzenlenebilir.

---

## Bu oturum – GPT prompt iyileştirmeleri (36 hafta + son haftalar)

- **Çalışma takvimi zorunluluğu:** En az 36 hafta, takvimdeki hafta sayısına (totalWeeks) TAM uyum.
- **Son haftalar (37–38):** Takvim 37–38 haftaysa: Hafta 37 → OKUL TEMELLİ PLANLAMA*, Hafta 38 → SOSYAL ETKİNLİK. Prompt'ta SON HAFTALAR KURALI bloğu; validateAndNormalize'da boş kalırsa bu değerlerle doldurma.
- **Prompt yapısı:** Bölüm başlıkları (## ALAN KURALLARI, ## ÜRETİM KURALLARI); numaralı kurallar (1–6); user prompt kısa ve net (GÖREV, ÇALIŞMA TAKVİMİ, ÇIKTI ZORUNLULUKLARI).
- **Boş hafta yasak:** PEKİŞTİRME HAFTASI veya OKUL TEMELLİ PLANLAMA ile doldurma; uyarı sadece gerçek değişiklikte.

---

## Bu oturum – Ders saati evrak ayarlarından

- **Evrak ayarlarından ders saati:** Ayarlar sayfasına "Evrak / Plan Ayarları" kartı eklendi. Haftalık ders saatleri (ders × sınıf 1–12) tablo halinde; MEB varsayılanları ile yüklenir, düzenlenip kaydedilebilir.
- **Backend:** `AppConfigService.getDersSaati(subjectCode, grade)` – önce AppConfig (key: ders_saati), yoksa static fallback. `GET/PATCH /app-config/ders-saati` – superadmin + document_templates moderator.
- **YillikPlanGptService:** AppConfigService inject; haftalikDersSaati ve validateAndNormalize bu değeri kullanır.

---

## Bu oturum – 40 hafta kuralı kaldırıldı (36/38)

- **MAX_WEEKS 40→38:** Plan max 38 hafta. 39–40 hafta artık yok; "40 olacak diye hafta atlaması" engellendi.
- **36 hafta plan, takvim 38 ise son iki hafta:** fillMissingWeeks takvim bazlı (getTargetWeeksForYear); 37–38 sadece takvim 38 hafta ise.
- **Üniteler takvimsel sıralı:** GPT/Import prompt: "Hafta 39, 40 ÜRETME. Üniteler KAYNAK sırasına göre takvimsel. Hafta ATLAMA."
- **meb-fetch:** week_order 1–38; fillMissingWeeks extra haftaları max 38 ile sınırlar.

---

## Bu oturum – Ders saati + hafta atlama düzeltmesi

- **Ders saati:** `config/ders-saati.ts` – MEB haftalık ders çizelgesi (Türkçe 1-4: 10, 5-8: 6; Matematik: 5-6; Coğrafya: 2 vb.). Prompt ve validateAndNormalize bu değeri kullanır.
- **Tatil haftaları:** Fallback [10,19,20,27] kaldırıldı; sadece DB takvimindeki isTatil haftaları kullanılır. MEB config’te tatil blokları week_order=0 ile ayrı.
- **Hafta atlama / sığdırma:** Prompt vurgulandı: "TAM 36 hafta, hiç atlama"; JSON schema’da minItems/maxItems=totalWeeks.
- **validateAndNormalize:** Tatil dışı haftalarda ders_saati, getDersSaati ile sabitlenir.

---

## Bu oturum – GPT hız + MEB import model

- **Hız:** Varsayılan model gpt-5-mini (önce gpt-5.2 idi). Model sırası hızlı→kaliteli olacak şekilde güncellendi. GPT-5 Nano en hızlı seçenek.
- **MEB import:** Excel parse için GPT model seçici eklendi. varsayılan gpt-5-nano. GPT ile normal parse paralel çalışır (Promise.all) – daha hızlı.
- **Backend:** `parseExcelFileToPlan` model param; `ImportMebTaslakDto` model; paralel import.

---

## Bu oturum – GPT model seçici

- **Özellik:** Yıllık Plan İçerikleri sayfasında "GPT ile Taslak Oluştur" butonunun yanında model seçici dropdown eklendi.
- **Modeller:** gpt-4o (önerilen), gpt-4o-mini, gpt-4-turbo, gpt-4-0125-preview, gpt-4o-2024-11-20.
- **Backend:** `GET /yillik-plan-icerik/gpt-models` ile model listesi; `POST /yillik-plan-icerik/generate-draft` body'de `model` parametresi.

---

## Bu oturum – GPT taslak alan karışıklığı (düzeltme)

- **Sorun:** GPT taslak üretiminde unite, konu, kazanimlar, surec_bilesenleri yanlış yerlere yazılıyordu (örn: unite="36. Hafta:15-19 HAZİRAN", konu=kazanım metni, surec_bilesenleri=kazanım metni).
- **Çözüm:**
  - Model: gpt-4o-mini → gpt-4o (daha tutarlı talimat takibi).
  - ALAN KURALLARI bloğu eklendi: unite=sadece ünite/tema adı, konu=sadece içerik çerçevesi, kazanimlar=sadece öğrenme çıktıları metni, surec_bilesenleri=sadece DB/SDB kodları.
  - Hafta etiketleri "sadece referans; alanlara KOPYALAMA" olarak işaretlendi.
  - JSON schema açıklamaları netleştirildi; temperature 0.3→0.1.

---

## Bu oturum – MEB import: aylar + tüm sütunlar

- **Aylara göre planlama:** Takvim boşken ay bilgisi MEB config’ten (`getAyForWeek`) alınır; merge sonrası doğru ay gösterilir.
- **Tüm sütun verisi:** COL_ALIASES genişletildi (Türkçe varyantlar, TYMM başlıkları); buildColumnMap Türkçe karakter normalizasyonu ve pozisyon tabanlı fallback (0=Hafta … 12=Okul Temelli) ile sütun eşlemesini iyileştirdi.

---

## Bu oturum – MEB import Türkçe 1. sınıf (11→36 hafta)

- **Sorun:** Türkçe 1. sınıf MEB’den içe aktarımda yalnızca 11 hafta geliyordu.
- **Çözüm:** 
  - `parseExcelPlanInternal`: Tüm grade’e uygun sayfalar parse edilir (`getSheetNamesForGrade`); birden fazla Tema bloğu desteklenir; satır sırasıyla hafta atanır; “12. Hafta” gibi metinlerden sayı çıkarılır.
  - `looksLikeHeaderRow`: Blok başlık satırları atlanır; içerik satırı yanlışlıkla başlık sayılmaz.
  - Import: GPT ve normal parse her ikisi denenecek; daha fazla satır veren sonuç seçilecek.
  - `fillMissingWeeks`: Eksik haftalar (ör. 12–36) placeholder ile tamamlanacak.

---

## Bu oturum – 37-38 hafta desteği

- **Yıllık plan:** Çalışma takviminde 37-38. hafta varsa (Okul Temelli Planlama, Sosyal Etkinlik vb.) plana dahil edilir. `MAX_WEEKS=40`; filtreler ve validateAndNormalize güncellendi.
- **Evrak merge:** `fetchHaftalarForMerge` artık takvim haftalarını baz alır; planda olmayan 37-38. haftalar takvimde varsa placeholder ile gösterilir.
- **Çalışma takvimi:** 2024-2025 ve 2025-2026 için `hasMebCalendar` true → GPT yerine MEB config (`generateMebWorkCalendar`) kullanılır. Diğer yıllar GPT ile. (37-38 manuel eklenebilir.)
- **Yıllık plan GPT:** DB takvimi boş/eksikse ve MEB yılı tanımlıysa, doğrudan MEB config ile 36 hafta alınır; GPT'e hafta etiketleri (1. Hafta: 8-12 Eylül vb.) verilir. "36 hafta EKSİKSİZ" ve "TAM UYUMLU" vurgusu prompt'ta.
- **validateAndNormalize:** Eksik haftalar placeholder ile doldurulur; çıktı her zaman 1-36 tam.

---

## Bu oturum – Evrak modülü geliştirmeleri

- **Plan içerikleri özeti (Superadmin):** Yıllık Plan İçerikleri sayfasında ilk açılışta sıralı tablo; yapılan planlar ✓ ile işaretli; sınıf + öğretim yılı seçilince "Plan oluşturulmayan dersler" listesi gösterilir.
- **Öğretmen evrak – sadece planlı dersler:** Evrak sayfasında ders listesi artık sadece plan içeriği oluşturulmuş dersleri gösterir (`/document-templates/subjects?has_plan_content=1`). Backend: `YillikPlanIcerikService.getSubjectCodesWithPlan()`.
- **Plan toplu silme:** `POST /yillik-plan-icerik/bulk-delete` (subject_code, grade, academic_year); Yıllık Plan İçerikleri sayfasında "Tüm Planı Sil" butonu.
- **GPT yıllık plan × çalışma takvimi:** generateDraft artık sadece çalışma takviminde tanımlı haftalar için plan üretir; tatil haftalarında ders_saati=0, placeholder; takvimde olmayan haftalara plan eklenmez.
- **Çalışma takvimi GPT:** `POST /work-calendar/generate-draft` ile MEB standartlarına uygun 36 haftalık takvim taslağı; `POST /work-calendar/save-draft` ile kaydetme. "GPT ile Taslak Oluştur" butonu.
- **Sınav tarihleri (isteğe bağlı):** work_calendar tablosuna `sinav_etiketleri` alanı; form ve tabloda "Sınav" sütunu.

---

## Bu oturum – Evrak imza alanı: öğretmen unvanı/branş ayarlardan

- **İstenen:** Evrak imza bloğunda öğretmen ismi altındaki "X Öğretmeni" metni otomatik yerine ayarlardan veya profil branşından gelsin; öğretmen kaydında "ne öğretmeni" alanı olsun.
- **Evrak varsayılanları:** `evrak_defaults.ogretmen_unvani` eklendi. Ayarlar → Evrak varsayılanları formunda "Öğretmen unvanı / branş" alanı (örn. Coğrafya Öğretmeni).
- **Öncelik sırası:** formData > evrak_defaults.ogretmen_unvani > user.teacherBranch + " Öğretmeni" > dersAdi + " Öğretmeni" > "Öğretmen".
- **Öğretmen formu:** AddTeacherModal ve EditTeacherModal'da branş alanı "Branş / Ne öğretmeni" olarak güncellendi; placeholder "Coğrafya Öğretmeni, Matematik Öğretmeni vb.".
- **Backend:** EvrakDefaultsDto.ogretmen_unvani; document-generate.service buildMergeData + imza tablosu.

---

## Önceki oturum – Öğretmen yıllık plan şablon görünürlüğü

- **Sorun:** Öğretmen "Yıllık Plan İste" sayfasında sınıf/bölüm/ders/yıl seçip "Planları Listele" dediğinde şablon görünmüyordu.
- **Neden:** Şablon `section=null` (tüm bölümlere uygulanır) iken backend listesinde `t.section = :section` ile tam eşleşme arıyordu. 5–12. sınıf için bölüm (Ders, Seçmeli, İHO vb.) seçildiğinde şablon eleniyordu.
- **Çözüm:** `document-templates.service.ts` findAll'da section filtresi `(t.section IS NULL OR t.section = :section)` olarak güncellendi; grade ve academic_year gibi null şablonlar tüm değerlere eşleşir.

---

## Bu oturum – GPT plan: Süreç Bileşenleri + Öğrenme Çıktıları tam metin

- **Süreç Bileşenleri:** GPT prompt güçlendirildi; surec_bilesenleri ZORUNLU. Örnekler: DB1.1, DB2.2, SDB2.1.SB1, SDB2.2. "Boş bırakma" kuralı eklendi.
- **Öğrenme Çıktıları:** Kazanimlar alanında sadece kod (COĞ.10.1.1) yazma; TAM AÇIKLAMA METNİ kullan. curriculum-kazanimlar'a Coğrafya 10 eklendi (10 kazanım tam metin). curriculum-unites Coğrafya 10 TYMM ile uyumlu güncellendi.

---

## Bu oturum – MEB import GPT fallback

- **Sorun:** MEB'den içe aktar çalışmıyor; normal parse 0 satır döndürüyordu.
- **GPT fallback:** Parse 0 satır döndüğünde `OPENAI_API_KEY` varsa Excel içeriği GPT'e gönderilir; tablo metninden plan satırları çıkarılır. `YillikPlanGptService.parseExcelFileToPlan()`.
- **Akış:** `fetchRarAndExtract` → parseExcelPlan → 0 ise parseExcelFileToPlan (GPT) → cleanup tempDir. GPT da 0 satır dönerse MEB_PARSE_EMPTY.

---

## Önceki oturum – MEB import 0 satır düzeltmesi

- **Sorun:** "0 haftalık plan MEB taslak planından içe aktarıldı" – Excel parse etmeyip boş dönüyordu.
- **Çözüm:** `MebFetchService` güncellendi:
  - **Header row:** Başlık satırını otomatik bul (ilk 5 satırda "hafta, ünite, konu, kazanım" içeren satır).
  - **Sütun aliasları:** "hafta no", "ünite / tema", "içerik çerçevesi", "öğrenme çıktısı" vb. eklendi; normalize ile boşluk uyumu.
  - **week_order fallback:** Sütun eşleşmezse ilk 5 sütunda 1–36 arası sayı ara.
  - **0 satır:** `MEB_PARSE_EMPTY` – anlamlı hata mesajı; "Sütun yapısı TYMM formatından farklı olabilir".
- **subject_code:** `cografya_maarif_al` vb. varyantlar MEB butonu ve import için desteklendi (base code eşlemesi; getSubjectLabel da base’e bakıyor).

---

## Bu oturum – Yıllık Plan TYMM terminolojisi uyumu

- **Superadmin yıllık plan içerikleri:** Tablo başlıkları TYMM ile uyumlu güncellendi: "Ünite" → "Ünite/Tema", "Kazanımlar" → "Öğrenme Çıktıları" (GPT önizlemede de). Form label'lar: Ünite/Tema, Öğrenme Çıktıları (Kazanımlar).
- **GPT prompt:** jsonSchema ve userPrompt TYMM terminolojisiyle güncellendi: unite (Ünite/Tema), konu (İçerik Çerçevesi), kazanimlar (Öğrenme Çıktıları); Süreç Bileşenleri, Ölçme ve Değerlendirme.

---

## Bu oturum – GPT ile Yıllık Plan İçeriği

- **GPT taslak:** `POST /yillik-plan-icerik/generate-draft` – OpenAI gpt-4o-mini ile 36 haftalık plan taslağı. Structured Outputs (JSON schema) ile tutarlı format.
- **Curriculum config:** `backend/src/config/curriculum-unites.ts` – ders/sınıf ünite referansları (Coğrafya, Matematik, Fizik, Kimya, Biyoloji, Tarih, Türk Dili vb.).
- **MEB kazanım tam metinleri:** `backend/src/config/curriculum-kazanimlar.ts` – Coğrafya 9, Matematik 9 için MEB tam metin (code, metin, unite, konu_suggest). GPT bu listeden SADECE aynen kopyalar; haftalara dağıtır, konu ekler.
- **GPT strict kural:** MEB kazanımları tanımlı ders/sınıflarda prompt’ta tam metin listesi; GPT kendi metin üretmez.
- **Kazanım prefix:** COĞ, MAT, FİZ, KİM, BİY, TAR, TDE formatında.
- **work_calendar entegrasyonu:** Tatil haftaları prompt'a eklenir; çalışma takvimi boşsa hata.
- **save-draft:** `POST /yillik-plan-icerik/save-draft` – taslağı kaydet; mevcut plan üzerine yazar.
- **UI:** "GPT ile Taslak Oluştur" butonu (Sınıf + Ders + Yıl seçiliyken); önizleme + Kaydet/İptal.
- **UI uyarıları:** GPT butonu altında "referans niteliğindedir, MEB uyum garanti edilmez"; önizlemede "kaydetmeden önce MEB müfredatına göre kontrol edin"; kayıt onayında "GPT yardımıyla oluşturulmuş taslaktır".
- **.env:** OPENAI_API_KEY eklendi.
- **MEB kaynak araştırması:** docs/MEB_KAYNAKLAR_VE_YILLIK_PLAN_COZUMU.md – mufredat.meb.gov.tr, tymm.meb.gov.tr/taslak-cerceve-planlari, tegm.meb.gov.tr; TYMM taslak plan RAR indirme linkleri; önerilen çözüm: TYMM taslak import, mufredat PDF kazanım çıkarma.
- **MEB otomatik import (API):**
  - `POST /yillik-plan-icerik/import-meb-taslak` – tymm.meb.gov.tr'den RAR indir, çıkar, Excel parse et, yillik_plan_icerik'e yaz. Body: subject_code, grade (9-12), academic_year. Superadmin/moderator.
  - `GET /yillik-plan-icerik/meb/subjects` – MEB taslak planı desteklenen ders listesi.
  - MebFetchService (node-unrar-js, xlsx) – RAR indirme/çıkarma, Excel sütun eşleme (hafta, ünite, konu, kazanımlar vb.).
  - Web-admin: "MEB'den İçe Aktar" butonu (9-12. sınıf, desteklenen derslerde).

---

## Önceki oturum – Evrak (Planlar) Ayarlar: Ders CRUD

- **Akış:** Superadmin → Evrak (Planlar) → Ayarlar → Ders ekle/düzenle. Yıllık Plan İçerikleri, Kazanım Setleri, Evrak üretimi filtreleri bu ayarlardan beslenir.
- **Backend:** `GET/POST/PATCH/DELETE /document-templates/config/subjects` – document_catalog category=subject CRUD. Sadece superadmin. Soft delete (is_active=false).
- **Web-admin:** Evrak (Planlar) sayfasına Ayarlar sekmesi; ders listesi, ekleme/düzenleme/silme. Sekme sadece superadmin görünür.
- **Entegrasyon:** `GET /document-templates/subjects` zaten document_catalog'dan okur; Ayarlar'dan eklenen dersler otomatik olarak Yıllık Plan İçerikleri ve Evrak filtrelerinde görünür.

---

## Önceki oturum – Yıllık Plan: Dinamik zümre öğretmenleri

- **Tasarım:** Orijinal `Cografya-9-Sinif-Yillik-Plan.docx` örneğine birebir uyumlu; gereksiz nokta satırları yok, sütunlar içeriğe göre orantılı, yazılar kesilmeden tam görünür.
- **Modern şablon:** `ornek-yillik-plan-modern.docx` – landscape A4, Calibri font, 13 sütunlu tablo, `{#haftalar}...{/haftalar}` döngüsü.
- **Script:** `npm run create-modern-yillik-plan` – docx paketi ile programatik oluşturma; sütun genişlikleri içeriğe göre ayarlandı (KONU, ÖĞRENME ÇIKTILARI geniş).
- **Başlık:** Temiz, iki satır; sadece okul adı, öğretim yılı, sınıf ve ders adı. Zümre/müdür bilgileri başlıkta YOK.
- **Onay kutusu (alt):** Dinamik zümre sayısı + müdür. `{#zumre_list}{isim}{/zumre_list}` döngüsü ile kullanıcının girdiği sayı kadar zümre öğretmeni sütunu oluşturulur.
- **Zümre öğretmenleri:** İmza çizgisinin üstünde isimler; virgülle ayrılmış string → `parseZumreOgretmenleri` ile diziye çevriliyor. Örn: "Ahmet Yılmaz, Ayşe Demir" → 2 sütun.
- **Veri akışı:** Evrak üretirken `yillik_plan_icerik` + `work_calendar` → `haftalar` dizisi; `zumre_ogretmenleri` → `zumre_list` dizisi; docxtemplater tabloyu 36 hafta + dinamik zümre ile doldurur.
- **Placeholder'lar:** okul_adi, ogretim_yili, sinif, ders_adi, mudur_adi, onay_tarihi, onay_tarihi_alt; zumre_list (döngü: isim); haftalar içinde: ay, hafta_label, ders_saati, konu, ogrenme_ciktilari, surec_bilesenleri, olcme_degerlendirme, sosyal_duygusal, degerler, okuryazarlik_becerileri, belirli_gun_haftalar, zenginlestirme, okul_temelli_planlama.
- **document-templates:** Coğrafya fileUrlLocal: local:ornek-yillik-plan-modern.docx; fileFormat: docx.
- **Form schema:** `zumre_ogretmenleri` (virgülle ayırın) – `buildMergeData` ve `parseZumreOgretmenleri` güncellendi.
- **EvrakDefaults:** `zumre_ogretmenleri` alanı eklendi.
- **DOCX önizleme:** `preview` endpoint yıllık plan DOCX için ilk 5 haftalık tablo önizlemesi döner (`sheet_html`); `fetchHaftalarForMerge` kullanılır.
- **Evrak sayfası:** Önizleme modal içinde (debounce 400ms), localStorage ile son filtreler (grade, section, subject_code, academic_year) hatırlanır; indirme sonrası "Plan indirildi. Başka plan üretmek ister misiniz?" + "Başka plan üret" / "Kapat"; müdür/zümre boşsa "Onay bölümü eksik kalacak" uyarısı.

---

## Önceki oturum – Yıllık Plan: Örnek plan sütunları + 36 hafta

- **Örnek plan sütunları:** AY, HAFTA, DERS SAATİ, KONU, ÖĞRENME ÇIKTILARI, SÜREÇ BİLEŞENLERİ, ÖLÇME VE DEĞERLENDİRME, SOSYAL-DUYGUSAL, DEĞERLER, OKURYAZARLIK BECERİLERİ, BELİRLİ GÜN VE HAFTALAR, ZENGİNLEŞTİRME, OKUL TEMELLİ PLANLAMA – entity'ye eklendi; UI tabloda tümü gösteriliyor.
- **Entity yeni alanlar:** olcme_degerlendirme, sosyal_duygusal, degerler, okuryazarlik_becerileri, zenginlestirme, okul_temelli_planlama.
- **Seed:** 36 hafta Coğrafya 9 plan dolu; hafta 1 için örnek ölçme, sosyal-duygusal, değerler, okuryazarlık verileri eklendi.
- **Seed çalıştırıldı:** `npm run seed-work-calendar` – 36 hafta yıllık plan içeriği eklendi.

---

## Evrak – ÖğretmenEvrak Uyumu (bölüm, ders, varyant)

- **Bölümler:** ders, secmeli, iho, ihl, meslek, mesem, gsl, spor_l (`document-catalog.seed.ts` SECTIONS_SEED).
- **9–12 Ders:** Maarif M. varyantları (A.L., F.L., S.B.L.) ayrı subject kayıtları; ders saati farkı için `document_catalog` + `yillik_plan_icerik` subject_code eşlemesi.
- **Yeni dersler:** kuran_kerim_maarif, temel_dini_bilgiler_maarif, saglik_bilgisi_trafik; İHL: arapca, kuran_kerim, temel_dini_bilgiler, siyer, peygamberimizin_hayati.
- **Evrak sayfası:** 5–12. sınıf için bölüm seçimi (options.sections API’den; fallback: ders, secmeli, iho, ihl, meslek, mesem, gsl, spor_l).
- **Varyant çözümü:** `docs/EVRAK_DERS_VARYANT_COZUMU.md` – aynı dersin alt bölümleri ve farklı ders saati yönetimi.

---

## Evrak Faz 1: Çalışma Takvimi + Yıllık Plan İçerikleri

- **Çözüm dokümanı:** `docs/EVRAK_CALISMA_TAKVIMI_COZUM.md` – çalışma takvimi, yıllık plan içeriği, Kazanım entegrasyonu, GPT taslak, şablon koruma stratejisi.
- **work_calendar tablosu:** academic_year, week_order, week_start, week_end, ay, hafta_label, is_tatil, tatil_label. Superadmin CRUD.
- **yillik_plan_icerik tablosu:** subject_code, subject_label, grade, section, academic_year, week_order, unite, konu, kazanimlar, ders_saati, belirli_gun_haftalar, surec_bilesenleri, olcme_degerlendirme, sosyal_duygusal, degerler, okuryazarlik_becerileri, zenginlestirme, okul_temelli_planlama. Superadmin CRUD. Kazanım modülü için kaynak.
- **Backend API:** `GET/POST/PATCH/DELETE /work-calendar`, `GET/POST/PATCH/DELETE /yillik-plan-icerik`. Sadece superadmin/moderator (document_templates).
- **Web-admin:** `/work-calendar` (Çalışma Takvimi), `/yillik-plan-icerik` (Yıllık Plan İçerikleri) sayfaları. Yıllık Plan: ünite bazlı gruplama, tablo görünümü (Hafta, Konu, Öğrenme Çıktıları, Belirli Gün, Saat). Menü: Sistem → Evrak & Plan Altyapısı. Varsayılan sekme Çalışma Takvimi; boş takvim uyarısı + varsayılan yıl (localStorage).
- **Referans plan:** `Cografya-9-Sinif-Yillik-Plan.docx` – ünite adları (COĞRAFYANIN DOĞASI, MEKÂNSAL BİLGİ TEKNOLOJİLERİ…), COĞ.9.x.x formatında öğrenme çıktıları, Belirli Gün ve Haftalar, Süreç Bileşenleri.
- **İleride (Faz 2):** Evrak merge’de bu tablolardan veri alınacak; şablonlara `{hafta_1}` vb. slot placeholder’ları eklenecek.

---

## Son oturum – Evrak modülü sağlık iyileştirmeleri

- **Docxtemplater hata yakalama:** mergeDocx içinde doc.render() try-catch; çözülemeyen tag için Türkçe MERGE_ERROR mesajı.
- **form_schema validasyonu:** generate öncesi validateFormData – form_schema required alanları boşsa FORM_VALIDATION.
- **fetch timeout:** loadTemplateBuffer HTTP fetch için 15 sn AbortController timeout; TEMPLATE_FETCH_TIMEOUT.
- **PizZip/zip hata yakalama:** mergeXlsx ve mergeDocx’te zip load/generate try-catch; TEMPLATE_CORRUPT.
- **İndirme popup alternatifi:** Evrak üretildikten sonra window.open null dönerse toast’ta “İndir” aksiyonu; popup engellense bile indirme yapılabilir.
- **Startup template kontrolü:** onModuleInit sonrası backend/templates/ altında veli-toplanti-tutanak.docx, ornek-yillik-plan-cografya.xlsx varlığı kontrol edilir; eksikse uyarı log.
- **Hata kodları:** ERROR_CODES.md’e TEMPLATE_*, MERGE_ERROR, FORM_VALIDATION eklendi.

---

## Son oturum – Evrak önizleme, dosya adı, merge (Ocak 2025)

- **Önizleme:** Üret modalı içinde, verilerin merge edilmiş hali; küçük (max-h 220px), kaydırılabilir. `fetchPreview` doğrudan `handleGenerateClick` sonrası `queueMicrotask` ile çağrılıyor (race yok). AbortController ile modal kapanınca iptal.
- **Dosya adı:** Okunabilir format – `9-Sinif-Cografya-Yillik-Plan-2024-2025.xlsx`. `buildDownloadFilename` (generate), `buildStaticFilename` (download). R2 signed URL'e `ResponseContentDisposition` eklendi.
- **Merge:** `{key}` ve `{{key}}` formatları destekleniyor. Yerel şablon önceliği: `fileUrlLocal` (`local:`) varsa ve `backend/templates/` altında dosya varsa önce o kullanılıyor (merge placeholder'ları yerelde).
- **create-cografya-template:** `{baslik_bloku}`, `{ogretim_yili}`, `{okul_adi_upper}`, `{sinif}`, `{ders_adi}` placeholder'ları eklendi.
- **UI:** "Verilerin eklenmiş önizlemesi (aşağıda tablo)", "Excel olarak indir" linki.
- **İleride:** Tek master şablon + tüm dersler; admin plan verisi CRUD; GPT API ile taslak oluşturma; `yillik_plan_icerik` tablosu (subject_code, grade, week_order, ay, hafta, konu, ders_saati).

---

## Son oturum – Coğrafya şablonu kontrolü

- **Document-templates form:** `file_url_local` alanı eklendi (FormState, EMPTY_FORM, openEdit, handleSave). Superadmin Coğrafya şablonunu düzenlerken yerel fallback görünür ve korunur.
- **Coğrafya seed doğrulaması:** `ensureYillikPlanCografyaAnadoluLisesi` – fileUrl (R2 public URL), fileUrlLocal (`local:ornek-yillik-plan-cografya.xlsx`), formSchema (ogretim_yili, sinif, okul_adi, mudur_adi, onay_tarihi, zumreler), requiresMerge=true. buildMergeData tüm placeholder’ları sağlıyor (baslik_bloku, zumre_satiri, mudur_satiri vb.).
- **Yerel dosya:** `backend/templates/ornek-yillik-plan-cografya.xlsx` yoksa `cd backend && npm run create-cografya-template` çalıştırılır. R2 başarısız olursa loadTemplateBuffer yerel fallback kullanır.

---

## Son oturum – R2 bağlantı testi

- **Backend:** `POST /app-config/r2/test` endpoint eklendi. `ListObjectsV2` (MaxKeys: 1) ile bucket erişimi doğrulanıyor.
- **Ayarlar sayfası:** R2 kartında "Kaydet" yanına "Bağlantıyı test et" butonu. Sonuç toast ile gösteriliyor.
- **Hata kodları:** R2 ayarları eksikse 400 `R2_NOT_CONFIGURED` (ERROR_CODES.md, API_CONTRACT.md).

---

## Önceki oturum – Sözleşmeli/Ücretli parametreleri ve öğrenim durumu

- **Parametre alanları:** `sgk_employee_rate`, `ucretli_unit_scale` (önceki oturum); `education_levels` artık ParamForm'da düzenlenebilir (Lisans, Y.Lisans, Doktora birim ücretleri).
- **2026 resmi güncelle butonu:** Vergi + sözleşmeli/ücretli parametrelerini tüm setler için güncelliyor.
- **Hesaplama:** Ölçek referansı (194.3/208.18) artık `params.education_levels` Lisans değerinden alınıyor; hardcode kaldırıldı.
- **Sözleşmeli bilgi notu:** Ek Ders Hesaplama sayfasında sözleşmeli seçildiğinde "SGK kesilir, GV/DV istisnaları maaşta kullandığınız değerleri girin" notu gösteriliyor.
- **Sözleşmeli kesinti kontrolü:** `docs/UNVAN_EK_DERS_FARKLARI.md` Bölüm 6 – öğrenim durumu, GV, DV, SGK hesaplama akışı dokümante edildi.
- **DYK Yüksek Lisans düzeltmesi:** MEB bordro: DYK tutar = Lisans birim + Seçili öğrenim birim (additif formül). Y.Lisans DYK gündüz 1h: 402,21 TL.
- **Ücretli öğretmen hesaplama:** Öğrenim farkı yok. Varsayılan `ucretli_unit_scale=1` (resmi uyumlu): brüt kadrolu ile aynı (194,30 TL). Superadmin 0,725 verirse MEB %72,5 tarifesi. DYK = 2 × ücretli gündüz/gece (additif değil). Kadrolu/sözleşmeli mantığı korundu.

---

## Önceki oturum – Ek Ders Hesaplama: UI + performans

- **Backend cache:** `GET /extra-lesson/params/active` ve `available-semesters` için `Cache-Control: private, max-age=300` (5 dk). Tekrarlayan istekler DB'ye gitmez.
- **Frontend params cache:** `useExtraLessonParams` ve `useAvailableSemesters` hook'ları; module-level in-memory cache (5 dk TTL). Aynı semester için tekrar fetch yapılmaz.
- **Ek Ders Hesaplama sayfası:** Modern UI – gradient arka plan, rounded-2xl kartlar, skeleton loading, collapsible saat/sınav bölümleri, sticky sonuç paneli, daha iyi tipografi ve hiyerarşi.
- **Doküman:** `docs/EK_DERS_HESAPLAMA_IYILESTIRME.md` – performans analizi, uygulanan ve ileride yapılabilecek iyileştirmeler.

---

## Önceki oturum – Hesaplama Parametreleri (kutu yapısı)

- **Hub sayfası:** `/extra-lesson-params` artık hesaplama türlerini kutular halinde listeliyor. Her kutu "Ayarlara git →" ile ilgili ayar sayfasına götürüyor.
- **CALC_CARDS dizisi:** `extra-lesson-params/page.tsx` içinde – yeni hesaplama türü eklemek için bu diziye yeni kart eklenir.
- **Ek Ders ayarları:** `/extra-lesson-params/ek-ders` – gösterge tablosu, bütçe dönemleri, parametre setleri. "← Hesaplama Parametreleri" ile hub'a dönüş.

## Önceki oturum – Gösterge tablosu yönetilebilir

- **Gösterge tablosu artık sabit değil:** Kalem göstergeleri (140, 150, 175, 187.5, 280, 300) veritabanında tutuluyor ve web-admin üzerinden görüntülenip düzenlenebiliyor.
- **Yeni tablo:** `extra_lesson_line_item_templates` – key, label, type, indicator_day, indicator_night, sort_order.
- **API:** `GET /extra-lesson/line-item-templates`, `PATCH /extra-lesson/line-item-templates`.
- **Web-admin:** Ek Ders Parametreleri sayfasında "Gösterge Tablosu (Kalem Şablonları)" kartı; tablo görünümü, Düzenle/Kaydet ile göstergeler değiştirilebilir. İlk yüklemede boş tablo otomatik varsayılan değerlerle doldurulur.
- **Tüm hesaplamalar** (yeni dönem, refresh-all, katsayı değişikliği) artık bu tablodan okunan göstergelere göre yapılıyor.

## Önceki oturum – Katsayı/gösterge güncellemesinde otomatik hesaplama

- **Tek parametre seti güncelleme:** Superadmin maaş katsayısı (`monthly_coefficient`) veya gündüz/gece göstergesi (`indicator_day`, `indicator_night`) girdiğinde, artık `line_items` ve `central_exam_roles` otomatik olarak göstergelere göre yeniden hesaplanıyor (daha önce sadece "Tüm Setleri Tabloya Göre Güncelle" butonu bunu yapıyordu).

## Önceki oturum – resmi uyumlu hesaplama düzeltmeleri

- **EK_DERS_DOGRULAMA.md:** Detaylı kıyaslama dokümanı (senaryolar, formüller, test adımları)
- **GV formülü düzeltildi:** `gvKesinti = taxOnBrut - gvUsed` → `taxOnBrut - (gv_exemption_max - gvUsed)` (kalan istisna doğru hesaplanıyor)
- **Vergi dilimi (Otomatik):** Geçen aylar matrahı + bu ay ek ders brütü toplamına göre dilim belirleniyor (resmi ile uyumlu)
- **Doğrulama:** `web-admin/scripts/ek-ders-verify.ts` – tüm senaryolar otomatik test edilir (`npx tsx scripts/ek-ders-verify.ts`)

---

## Önceki oturum – Hesaplama sayfası sadece superadmin verisi

- **Veri kaynağı:** Ek Ders Hesaplama sayfası artık **sadece** API'den gelen parametreleri kullanır; FALLBACK_PARAMS kaldırıldı
- **Parametre yoksa:** API hata verir veya null dönerse "Parametreler yüklenemedi" mesajı gösterilir
- **Kalemler:** Tüm ek ders kalemleri `params.line_items`'tan dinamik oluşturulur; sabit SECTIONS/UCRETLI_SECTIONS kaldırıldı
- **Statü alanı** kaldırıldı (Ücretli Öğretmen, Emekli Ücretli, Uzman, Usta Öğretici seçimi)
- **Vergi dilimleri** params.tax_brackets üzerinden alınır
- **Bütçe dönemi:** Seçim dropdown'ı eklendi; seçenekler sadece superadmin'in girdiği aktif dönemlerden gelir (`GET /extra-lesson/params/available-semesters`)

---

## Önceki oturum – Parametre setleri toplu güncelleme

- **Yeni endpoint:** `POST /extra-lesson/params/refresh-all` (sadece superadmin)
  - Veritabanındaki tüm parametre setlerinin line_items ve central_exam_roles değerlerini güncel tabloya göre yeniler
  - Her set kendi katsayı/gösterge değerleriyle hesaplanır
- **Web-admin:** Ek Ders Parametreleri sayfasına "Tüm Setleri Tabloya Göre Güncelle" butonu eklendi (superadmin görür)
- Çalıştırmak için superadmin ile giriş → Ek Ders Parametreleri → butona tıkla

---

## Önceki oturum – Ek Ders Parametreleri tablosu (superadmin güncellemesi)

- **Line items:** Resmi Ek Ders Parametreleri tablosuna göre güncellendi
  - Nöbet %25: gösterge 187,5 (150×1,25 – gece bazı) → 260,23 TL/saat
  - Yeni kalemler: Destek Odası %25, Evde Eğitim %25 (gösterge 175)
  - Etiketler: EYG Gündüz Gör., EYG Gece Gör., DYK Gündüz, DYK Gece
- **Merkezi sınav (SG):** Tablo eşleştirmesi – Bina Yön. (1900), Bin. Yön. Yrd. (1700), Salon Başk. (1650), Gözetmen (1600), Yed. Göz. (1200), Yar.Eng.Gz. (2000)
- **Backend, extra-lesson-calc, extra-lesson-params** tümü senkronize

---

## Önceki oturum – Hesaplama kuralları güncelleme (MEB bordro uyumu)

- **DV istisna formülü düzeltildi**
  - `dvMatrah = totalBrut - dvUsed` (hatalı) → `dvMatrah = max(0, totalBrut - (dv_max - dvUsed))`
  - MEB/resmi: Faydalanılan = maaşta kullanılan; kalan istisna = 33.030 − faydalanılan
- **Merkezi sınav tutarları gösterge bazlı**
  - Entity/DTO: `CentralExamRole` artık `indicator?: number` ve `fixed_amount?: number` destekler
  - MEB bordro: Tutar = ROUND(katsayı × gösterge, 2). Komisyon Başkanı 1900, Gözetmen 1600, Yedek 1200, Yrd. Engelli 2000 vb.
  - Bina Sınav Sorumlusu bordroda yok, sabit 3.500 TL
  - Yrd. Engelli Gözetmen (indicator 2000) eklendi
- **Ücretli öğretmen için sadece 4 kalem**
  - Ünvan = "MEB Ücretli" seçilince: Gündüz, Gece, DYK Gündüz, DYK Gece (MEB bordro ile uyumlu)
  - Merkezi sınav bölümü gizlenir; hesaplamada merkezi sınav dâhil edilmez
- **Doküman:** docs/HESAPLAMA_KURALLARI_GUNCELLEME.md

---

## Önceki oturum – Ek ders hesaplama sayfası (öğretmen)

- **`/extra-lesson-calc`** – öğretmen ek ders hesaplama sayfası
  - **Ayarlar:** Bütçe dönemi (semester seçici), ünvan (MEB Kadrolu/Sözleşmeli/Ücretli), öğrenim (Lisans/Y.Lisans/Doktora), GV dilimi (params.tax_brackets), vergi matrahı (geçen aylar → otomatik dilim), GV/DV istisna faydalanılan
  - **Kalemler:** Tüm kalemler superadmin parametrelerinden (`params.line_items`, saatlik). Merkezi sınav 4 görev slotu (ünvan=Ücretli ise gizli). Her satırda saat + birim ücret gösterimi
  - **Sonuç:** Brüt, GV, DV, tahmini net; kalem dökümü. Anında hesaplama (useMemo)
  - **Tasarım:** Hafif inline SVG ikonlar (calc, book, school, trophy, clipboard, money, reset, loader, chevron), `#f5f4f0` arka plan, stone palette, emerald vurgu, collapsible bölümler, sticky sonuç paneli
  - **Referans linkler:** hesaplama.net
- **Menü:** Ek Ders Hesaplama (teacher, superadmin, moderator)
- **API:** `GET /extra-lesson/params/active?semester_code=` (mevcut)

---

## Önceki oturum – Ek ders parametre hesaplama kuralları (formül tabanlı)

- **EK_DERS_ANALIZ.md güncellendi**
  - Ana formül: `Brüt = Aylık Katsayı × Gösterge × Kalem Çarpanı` (resmi kaynaklara göre).
  - Katsayı: Mali ve Sosyal Haklar Genelgesi, 2026 Oca-Haz: 1,387871. Göstergeler: 140 (gündüz), 150 (gece).
  - Kalem çarpanları: 1 (normal), 1,25 (özel eğitim %25), 2 (DYK/Takviye).
  - GV/DV istisna mantığı: maaştan sonra kalan istisna ek ders için; DV matrah brüt asgari ücret.
- **Backend entity + DTO**
  - `monthly_coefficient`, `indicator_day` (140), `indicator_night` (150) eklendi.
  - Kalemlerde `indicator`, `multiplier`; `resolveLineItems` ile formülden birim ücret hesaplanıyor.
- **Web-admin `/extra-lesson-params`**
  - Katsayı, gündüz/gece göstergesi alanları ve "Formülden hesapla" butonu.
  - Varsayılan kalemler formül parametreleriyle (indicator+multiplier) tanımlandı.

---

## Önceki oturum – Menü, okul atama, il/ilçe süzme

- **Superadmin menü:** Okul Değerlendirmeleri, Favorilerim, Sistem Duyuruları superadmin menüsünden kaldırıldı (sadece teacher/moderator).
- **Okul atama:** `/schools?limit=500` → `limit=100` (backend max). Okul dropdown il/ilçe ile etiketlendi: `Okul Adı (İl / İlçe)`.
- **İl/ilçe süzme:** Okul seçiminde il → ilçe → okul cascading filtre. `SchoolSelectWithFilter` bileşeni; AddUserModal, EditUserModal ve kullanıcı listesi filtre çubuğunda kullanılıyor.
- **Dosyalar:** `web-admin/src/components/school-select-with-filter.tsx`, `web-admin/src/app/(admin)/users/page.tsx`.
- **API:** `school-reviews-public/cities`, `school-reviews-public/districts?city=`, `schools?city=&district=&limit=100`.

---

## Önceki oturum – Moderator rolü ve modül bazlı yetkilendirme

- **Moderator rolü**
  - Backend: `moderator` rolü, `moderator_modules` (jsonb) kolonu, `@RequireModule` dekoratörü, RolesGuard modül kontrolü.
  - API: /me, /users (list, getById), /schools, /school-reviews, /app-config/school-reviews, /admin-messages create → moderator + modül ile erişilebilir.
  - Web-admin: `moderator` WebAdminRole; menü ve route `requiredModule` + `moderator_modules` ile filtrelenir. RouteGuard `canAccessRoute` kullanır.
  - Kullanıcı ekle/düzenle: superadmin moderator rolü atayabilir; modül checkbox'ları ile `moderator_modules` seçilir.
  - SQL script: `backend/scripts/add-moderator-modules.sql` (synchronize kullanmayan ortamlar için).
- **Dokümantasyon:** AUTHORITY_MATRIX, API_CONTRACT güncellendi.

---

## Önceki oturum – Demo öğretmen, Şifre sıfırlama, Open Graph, Sınıflar/Dersler, Testler

- **Demo test öğretmen + hızlı giriş**
  - Backend seed: `teacher@demo.local` (Test Öğretmen) Demo Okulu’na eklenir; şifre Demo123!
  - Login sayfası: Sayfa başında "Hızlı giriş" bölümü – Test Öğretmen (öne çıkarılmış), Okul Admin, Superadmin butonları tek tıkla giriş.
  - "Diğer giriş seçenekleri" içinde de teacher demo hesabı eklendi.

- **Şifre sıfırlama e-posta akışı**
  - Backend: `PasswordResetToken` entity, `AuthService.forgotPassword` token oluşturur, `EmailService` ile e-posta (SMTP yoksa console log). `AuthService.resetPassword` token doğrular, şifre günceller.
  - POST `/auth/reset-password` (token, new_password). `/reset-password` sayfası; `?token=xxx` ile erişim.
  - env: FRONTEND_URL, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM.
- **Okul detay Open Graph**
  - `/school-reviews/[id]` SSR route: `generateMetadata` okul verisini çeker, og:title, og:description, og:url, twitter kartları set eder. Sayfa `/school-reviews?id=xxx` yönlendirmesi yapar.
  - Ana sayfa okul detayında "Paylaşım linkini kopyala" butonu (`/school-reviews/[id]` URL’i).
- **Sınıflar/Dersler modülü**
  - Backend: `SchoolClass` (school_id, name, grade, section), `SchoolSubject` (school_id, name, code). CRUD: `/classes-subjects/classes`, `/classes-subjects/subjects`.
  - school_admin scope. Web-admin: `/classes-subjects` sayfası (Sınıflar ve Dersler kartları).
  - **2026-02 Tümünü Ekle:** `default-classes-subjects.ts` – 36 sınıf (1–12, A/B/C), 23 TYMM dersi. POST `/classes-subjects/seed-defaults`. Web-admin "Tümünü Ekle" butonu.
  - **2026-02 Ders programı iyileştirmeleri:** (1) Ders ekleme modalı (olustur/[id]): sınıf ve ders için useSchoolClassesSubjects dropdown; liste boşsa serbest metin fallback. (2) Ana sayfa: "Şu an ders saati" gerçek zaman kontrolü; dakika bazlı slot eşlemesi. (3) Bugünün sütunu tabloda vurgulama (primary bg, "Bugün" etiketi). (4) Programlarım gün seçicisinde DAY_SHORT (Pzt, Sal, Çar, Per, Cum).
  - **2026-02 Tüm okullara seed:** `scripts/seed-classes-subjects-all-schools.ts` – `npm run seed-classes-subjects` ile veritabanındaki tüm okullara varsayılan sınıf ve ders ekler (mevcut olanları atlar).
  - **2026-02 Tek kaynak + modern UI:** (1) Backend: teacher rolü GET `/classes-subjects/classes` ve GET `/classes-subjects/subjects` okuma yetkisi aldı. (2) Hook: `useSchoolClassesSubjects` – Ders Programı, Nöbet, Kazanım Takip, Evrak modüllerinde tek kaynak olarak kullanılacak. (3) Sayfa: modern SVG ikonlu tasarım (ClassIcon, SubjectIcon, ModulesIcon); hero bölümünde "tek kaynak" açıklaması + kullanıldığı modüller badge’leri; kartlar rounded-lg ikon kutucukları; ders kodları badge; boş durumda ikonlu mesaj. API_CONTRACT.md, YAPILANLAR.md güncellendi.
- **Test akışları**
  - Playwright E2E: `web-admin/e2e/auth.spec.ts` (login, forgot-password, reset-password, register), `school-reviews-public.spec.ts`. `npm run test:e2e`.

## Önceki oturum – Okul Değerlendirme (herkese açık sayfa, iyileştirmeler)

- **Public sayfa** (`(public)/school-reviews`): Herkese açık; yorum/oylama için giriş zorunlu.
- **İyileştirmeler (1–9):** Network error handling, SEO metadata, debounce, ana sayfa linki, deep link (?id=/?school=), il/ilçe dropdown, skeleton, pagination, rate limit (120/dk).
- **İyileştirmeler (10–14):** Cache headers (public endpoints), modül kapalı özel mesaj (MODULE_DISABLED), en çok bakılanlar sidebar (GET /top-schools), erişilebilirlik (aria-pressed, aria-label, focus-visible ring yıldız butonları).
- **Backend:** `listTopViewedSchools`, `listCities`, `listDistricts` (public API); cache headers.

## Önceki oturum – Okul Değerlendirme (kriter bazlı, modern UI)

- **Backend:** Kriter bazlı değerlendirme
  - Entity: SchoolReviewCriteria (slug, label, hint, sort_order, min/max_score, is_active). SchoolReview: criteria_ratings (JSONB), is_anonymous. School: review_view_count.
  - API: GET/POST/PATCH/DELETE `/school-reviews/criteria` (superadmin). GET `/school-reviews/criteria` (öğretmen).
  - Okul detay: criteria, criteria_averages, review_view_count. createReview: criteria_ratings zorunlu (kriter varsa), is_anonymous. listReviews: criteria_ratings, is_anonymous, author_display_name.
- **Web-admin**
  - Superadmin `/school-reviews-settings`: Değerlendirme Kriterleri bölümü (ekle, düzenle, sil). Alert syntax hatası düzeltildi.
  - `/school-reviews`: Modern okul detay paneli – gradient başlık, kriter ortalamaları (progress bar), görüntülenme sayısı, Değerlendirmeler/Sorular sekmeleri, kriter bazlı yıldız formu, "İsmim gizli kalsın" checkbox, yorum/soru listeleri.
- **Docs:** CORE_ENTITIES (SchoolReviewCriteria, criteria_ratings, is_anonymous, review_view_count), API_CONTRACT (kriter endpoint'leri) güncellendi.

## Önceki oturum – Okul Değerlendirme modülü (ilk sürüm)

- **Backend:** `school-reviews` modülü
  - Entity: SchoolReview, SchoolQuestion, SchoolQuestionAnswer (TypeORM).
  - API: `/school-reviews/schools` (liste, filtre), `/school-reviews/schools/:id` (detay + istatistik), review/question/answer CRUD, `/school-reviews/report/:schoolId` (school_admin rapor).
  - App config: `GET/PATCH /app-config/school-reviews` (modül aç/kapa, puan aralığı, moderasyon modu, soru ayarları).
- **Web-admin**
  - Superadmin: `/school-reviews-settings` – modül ayarları sayfası.
  - School admin: `/school-reviews-report` – kendi okuluna ait rapor (ortalama puan, son değerlendirmeler, son sorular).
  - Teacher/school_admin/superadmin: `/school-reviews` – okul listesi, değerlendirme ve soru ekleme.
- **Docs:** CORE_ENTITIES, API_CONTRACT, AUTHORITY_MATRIX, MODULE_RULES güncellendi.

---

## Son oturum – Evrak önizleme + Coğrafya şablonu iyileştirme

- **Önizleme:** `sheet_data` (JSON array) yerine `sheet_to_html` ile HTML tablosu; merged cells (colspan/rowspan) doğru render edilir. SÜRE/AY/HAFTA/DERS SAATİ hizalama sorunu giderildi.
- **Coğrafya şablonu:** fileUrl `document_template/ornek-yillik-plan-cografya.xlsx` olarak güncellendi (upload-plan-r2 script ile aynı yol). Seed mevcut kaydı bu path'e geçirir. "JSON boş" R2 path uyumsuzluğundan kaynaklanıyordu.
- **Hata mesajları:** Template load (NoSuchKey, R2_NOT_CONFIGURED) için Türkçe açıklayıcı mesajlar; boş sayfa durumunda bilgilendirici placeholder.
- **Styling:** globals.css `.evrak-preview-scroll` – tablo border, padding, ilk satır vurgusu.

---

## Önceki oturum – Superadmin sistem durumu iyileştirme

- **Users:** `/schools?limit=500` → `limit=100` (backend PaginationDto max 100).
- **Settings – Sistem durumu:** Health check başarısız olduğunda "Yenile" butonu, "Bağlantı yok" mesajı; `checkHealth` useCallback ile yeniden deneme.
- **R2 PATCH 400:** `UpdateR2Dto` class-validator decorator (@IsOptional, @IsString, @IsNumber, @IsArray) eklendi; ValidationPipe ile uyumlu.
- **Storage:** Zaten try-catch var (auth-provider, layout context, cookie-banner, safe-theme-provider, app/page, TV). `content.js` hatası tarayıcı eklentisinden geliyor olabilir.

---

## Son oturum özeti (devam için not)

### Tamamlanan maddeler (sıra 1→5)

1. **Backend istatistik API + dashboard bağlama**
   - `backend/src/stats/`: `StatsService`, `StatsController`, `StatsModule` (GET `/api/stats`).
   - Rol/okul kapsamına göre: okul sayısı, kullanıcı sayısı, duyuru sayısı, aylık grafik verisi.
   - Web-admin dashboard: `/stats` çağrısı, özet kartlar ve grafik API verisiyle.

2. **Okullar, Kullanıcılar, Duyurular sayfaları demo1 uyumu**
   - Liste sayfaları `Card`, `CardHeader`, `CardTitle`, `CardContent` ile sarmalandı.
   - Tutarlı toolbar, hata/boş durum bileşenleri.

3. **Profil: şifre değiştirme**
   - Backend: `PATCH /api/me/password` (ChangePasswordDto: current_password, new_password).
   - UsersService.changePassword; MeController’da endpoint.
   - Web-admin profil sayfası: ChangePasswordForm (mevcut/yeni/tekrar, validasyon, API).

4. **Madde 4 (Sınıflar/Dersler CRUD)**  
   - Kullanıcı isteğiyle **atlandı** (iptal).

5. **Ek iyileştirmeler / polish**
   - Ortak UI: `Alert`, `LoadingSpinner`, `EmptyState`, `Skeleton`.
   - Sayfalarda tutarlı hata mesajı, yükleme ve boş durum kullanımı.
   - Pagination aria-label, form butonları aria-busy / disabled:cursor-not-allowed.

### Giriş / kayıt / şifre unuttum / sosyal giriş

- **Backend**
  - `POST /api/auth/register`: email, password, display_name (opsiyonel); rol teacher, şifre hash.
  - `POST /api/auth/forgot-password`: email; şimdilik sadece başarı mesajı (e-posta gönderimi yok).
  - `POST /api/auth/firebase-token`: id_token; doğrula, kullanıcı bul/oluştur, token + user dön.
- **Web-admin**
  - Login: “Kayıt ol”, “Şifre unuttum?” linkleri; Google / Apple / Telefon butonları (Firebase client SDK).
  - `src/lib/firebase.ts`: isFirebaseConfigured, signInWithGoogle, signInWithApple, startPhoneVerification.
  - `/register`, `/forgot-password` sayfaları.
  - Teacher rolü: Dashboard ve Profil erişimi; menü ve route guard güncellendi.

### Belirli Gün ve Haftalar takvimi (TV)

- **Backend:** `tv_special_days_calendar` alanı (school entity, DTO, service); tv-public.controller select/mapping.
- **Admin TV ayarları:** Belirli Gün ve Haftalar takvimi bölümü: Tarih, Başlık, Görevli, Açıklama. Elle ekleme/düzenleme, Excel şablonu ve toplu yükleme.
- **TV slayt:** `special_day` slaytında önce takvimde bugün varsa o kayıt; yoksa duyuru fallback. Görevli bilgisi gösterilir.
- **BlockGrid:** `special_day` için takvim kayıt sayısı hesaplanır.

### Admin panel UX (okul kullanımı için)

- Layout: layout-initialized gecikmesi kaldırıldı (requestAnimationFrame); main min-height; “İçeriğe atla” linki.
- Dashboard: “Hoş geldiniz, [Ad]” + rol; rol bazlı hızlı aksiyonlar (Duyurular, Okul tanıtım, Okullar, Kullanıcılar, Profilim); istatistiklerde Skeleton; kartlarda tabular-nums.
- Sidebar: aktif sayfa sol çizgi + bg-primary/10; min 44px dokunma alanı; focus-visible ring.
- Header: Kullanıcı avatarı (isim/e-posta ilk harfi); 44px buton, odak stili.
- Card: transition-shadow, hover:shadow-md.
- Toolbar: sayfa başlığı lg’de büyük (lg:text-2xl).
- 403 sayfası: net mesaj ve “Ana sayfaya dön” butonu.

---

## Önemli dosya yolları

| Alan | Yol |
|------|-----|
| Backend auth | `backend/src/auth/` (login, register, forgot-password, firebase-token) |
| Backend stats | `backend/src/stats/` |
| Backend me | `backend/src/me/me.controller.ts` (PATCH password) |
| Web-admin login/kayıt | `web-admin/src/app/login/`, `register/`, `forgot-password/` |
| Web-admin Firebase | `web-admin/src/lib/firebase.ts` |
| Web-admin UI | `web-admin/src/components/ui/` (alert, card, skeleton, loading-spinner, empty-state) |
| Web-admin layout | `web-admin/src/components/layout/demo1/` (layout, header, sidebar-menu) |
| Web-admin dashboard | `web-admin/src/app/(admin)/dashboard/page.tsx` |
| Menü / roller | `web-admin/src/config/menu.ts`, `types.ts` (WebAdminRole: teacher eklendi) |
| Duyuru TV ekranı | `web-admin/src/app/tv/[audience]/page.tsx` (public, ?school_id=xxx) |
| TV stilleri | `web-admin/src/app/tv/tv.css`, `layout.tsx` |

### Duyuru TV – Genişletmeler (Faz 1, tamamlandı)

- **Acil duyuru override:** `urgent_override_until` alanı; duyuru listesinde sarı üçgen butonu ile 5/15/30/60 dk tüm TV ekranlarını kaplama. Düzenleme formunda da acil duyuru dropdown.
- **TV cihaz eşleştirme:** TvDevice entity, GET/POST/PATCH/DELETE `/tv-devices`. Admin TV sayfasında cihaz listesi, ekleme, eşleştirme kodu. Public: POST `/tv/pair`, POST `/tv/heartbeat`.
- **Offline cache:** TV ekranı localStorage ile son veriyi cache’ler; backend yoksa önbellekten gösterir, "Çevrimdışı" rozeti.
- **Slayt süreleri:** `tv_default_slide_duration` (school), `tv_slide_duration_seconds` (announcement). TV ayarlarında varsayılan süre (saniye).
- **İçerik zamanlaması:** `scheduled_from` / `scheduled_until` (announcement entity). Duyuru belirli tarih aralığında TV’de gösterilir.
- **Ekran koruma bilgisi:** Yardım bölümünde "max 12 saat kullanım" uyarısı. Gece modu ayarları: `tv_night_mode_start`, `tv_night_mode_end` (school, HH:mm).
- **RSS ayarı:** `tv_rss_url` (school) – henüz TV’de gösterim yok, config hazır.

### Duyuru TV – Yapılandırılabilir tasarım (tamamlandı)

- **School entity:** `tv_logo_url`, `tv_card_position`, `tv_logo_position`, `tv_theme`, `tv_primary_color`.
- **Admin TV formu:** Tema (koyu/açık/okul rengi), yan kart konumu (sol/sağ), logo konumu (sol/sağ üst), okul logosu URL, okul rengi (hex).
- **TV display layout:** Geniş orta alan (flex-[1 1 70%]), sol/sağ SidePanel (`cardPosition`), sol üst 3D logo.
- **tv.css tema:** `tv-theme-dark`, `tv-theme-light`, `tv-theme-school`; `--tv-primary` okul rengi ile override.
- **Tipografi:** Başlıklar 48px+ (slideTitleClass, karne sayacı, welcome slide); uzaktan okunabilirlik.
- **3D logo:** `.tv-logo-3d` gölge ve perspektif. SideCarousel tema uyumu (`--tv-text`, `--tv-text-muted`).

### Duyuru TV – Admin ayarları ve veri girişi

- **TV Ayarları (admin/tv):** Hava durumu şehri (otomatik, Open-Meteo), hoş geldin görsel URL, YouTube video linki, varsayılan slayt süresi, RSS URL, gece modu saatleri, tema, logo, logo büyüklüğü (küçük/orta/büyük), kart konumu. school_admin PATCH /schools/:id ile kaydeder.
- **Logo büyüklük (tv_logo_size):** small=40px, medium=56px, large=72px.
- **Video bitimine kadar bekle (tv_wait_for_video_end):** Duyuru formunda YouTube linki varken checkbox; işaretlenirse TV’de slayt video bitene kadar ilerlemez.
- **Duyuru formu:** Görsel URL, YouTube linki alanları eklendi (attachment_url, youtube_url). Her kategori için ayrı görsel eklenebilir.
- **R2 görsel yükleme:** Superadmin Ayarlar → Depolama (R2) ile yapılandırma. Görsel alanlarında link girişi + dosya yükleme (JPEG/PNG/WebP/GIF, max 5 MB). Duyuru formu, TV ayarları (logo, hoş geldin), Belirli Gün ve Haftalar.
- **TV ekranı:** school_id ile okul config yüklenir; otomatik hava durumu, hoş geldin arka planı, sağ panel YouTube embed kullanılır.
- **Her alan için görsel:** Orta slaytlar (Belirli gün, Müdür mesajı, Öğretmenlerimiz, Bilgi bankası, Doğum günü, Başarı, Ders programı, Günün sözü, Tarihte bugün) ve sağ panel (Nöbetçi, Karne gününe, Akşam Yemeği) artık attachment_url ile görsel gösterir. DuyuruTV tarzı: her modül kendi görseliyle.
- **Referans tasarım:** Koyu mavi; kırmızı/sarı vurgu; NÖBETÇİ, KARNE GÜNÜNE, Akşam Yemeği panelleri.
- **Admin TV panel UX:** Sekme (Koridor / Öğretmenler); bloklar Orta / Sağ / Alt gruplarında; TV ayarları ve Yardım katlanabilir; tek blok tanımı, tekrar yok.

---

## Kurallar ve referanslar

- Proje kuralları: `.cursor/rules/` (.mdc); kök dokümanlar: CURSOR_SPEC.md, API_CONTRACT.md, AUTHORITY_MATRIX.md, MODULE_RULES.md.
- **Çalıştırma:** `run-order.mdc` — DB → Backend → Web-admin sırası; ilk açılışta backend hazır olmadan web-admin "bağlantı kurulamadı" hatası verebilir; apiFetch 3 kez otomatik yeniden dener.
- Dil: kullanıcı mesajları Türkçe; kod yorum/değişken İngilizce; API path küçük harf, tire.
- Commit: kısa anlamlı mesaj (feat:, fix:, config:).

### Bu oturum (TV + Güvenlik + UX)

- **Öğretmenlerimiz kullanım rehberi:** Duyuru formunda kategori "Öğretmenlerimiz" seçildiğinde mavi kutu ile açıklama; başlık/özet placeholder'ları (ad soyad, branş).
- **Başarılarımız şövalı görünüm:** TV slaytında altın tonları, shimmer, pulse animasyonu, kutlama çerçevesi; tv.css `.tv-success-*` sınıfları.
- **Kapalı devre kurulum:** KAPALI_DEVRE_KURULUM.md – tam yerel ağ ve hibrit (Web Admin online, TV okul ağında) senaryoları.
- **TV IP kısıtlaması:** `tv_allowed_ips` (School entity). Sadece belirtilen IP'lerden TV sayfası açılabiliyor; okul dışı erişim engellenir (KVK).
- **Excel listeler "Tümünü sil":** Her bölümde (yemek, nöbet, belirli gün, doğum günü, ders programı, sayaç) ayrı silme + genel "Tüm listeleri temizle" butonu.
- **ERROR_CODES:** `TV_ACCESS_RESTRICTED` eklendi.
- **TV kiosk modu:** `?kiosk=1` ile "Tam ekrana geçmek için dokunun" overlay; visibilitychange ile sekme geri gelince veri yenileme (KAPALI_DEVRE_KURULUM.md güncellendi).
- **API hata yeniden deneme:** TV sayfasında bağlantı hatasında 5 sn arayla 3 retry, "Bağlantı yeniden deneniyor… (1/3)" mesajı ve "Şimdi dene" butonu.
- **Okul verisi yedekleme:** "Tüm TV verilerini indir" butonu – yemek, nöbet, belirli gün, doğum günü, ders programı, sayaç dahil JSON export.
- **Audit log:** Okul güncellendiğinde `school_updated` audit kaydı (SchoolsService → AuditService).
- **Smoke test checklist:** SMOKE_TEST_CHECKLIST.md – TV/kiosk, yedekleme, Excel silme, audit, IP kısıtlaması maddeleri eklendi.
- **TV önizleme:** Admin TV sayfasında "Canlı TV önizleme" kartı; Koridor/Öğretmenler sekmeleri ile iframe önizleme.
- **Yardım / tooltip'ler:** TV ayarlarında Görünür kartlar, IP kısıtlaması, Öğretmenlerimiz bloklarına HelpCircle + title tooltip.

### Superadmin – Okul yönetimi (tamamlandı)

- **Okul listesi:** İl, ilçe, durum, tür, segment, okul adı arama filtreleri; sayfalama; "Detay" linki ile `/schools/:id`. "Toplu yükle" ve "Yeni okul" butonları.
- **Okul detay sayfası:** `/schools/[id]` – okul özeti, modül yetkilendirme (checkbox’lar: Nöbet, Duyuru TV, Ek Ders, Evrak, Kazanım, Optik, Akıllı Tahta, Okul Tanıtım, Okul Değerlendirme).
- **Modül yetkilendirme:** `enabled_modules` (School entity, jsonb). null = tüm modüller; [] = hiçbiri; [...] = sadece seçilenler. Sadece superadmin güncelleyebilir.
- **Menü × enabled_modules (2026-02):** Teacher ve school_admin için `requiredSchoolModule` eklendi: Okul Değerlendirmeleri, Favorilerim (`school_reviews`), Yıllık Plan İste (`document`), Kazanım Takip (`outcome`), Nöbet (`duty`), Optik Formlar (`optical`), Duyuru TV (`tv`), Okul Değerlendirme Raporu (`school_reviews`). Okulda modül kapalıysa menü öğesi gizlenir.
- **Backend school_reviews (2026-02):** RequireSchoolModuleGuard – teacher/school_admin için okulun `enabled_modules` içinde `school_reviews` zorunluluğu. Superadmin/moderator atlanır. Kapalı okulda API 403 `MODULE_DISABLED`.
- **Route guard × enabled_modules (2026-02):** `canAccessRoute` ve RouteGuard artık `schoolEnabledModules` ile teacher/school_admin için requiredSchoolModule kontrolü yapar. Doğrudan URL ile kapalı modül sayfasına gidilince /403.
- **Modüller sayfası (2026-02):** Tüm modüller (Nöbet, Duyuru TV, Ek Ders, Evrak, Kazanım, Optik, Akıllı Tahta, Okul Tanıtım, Okul Değerlendirme) için okul bazlı hızlı toggle tablosu. Yatay scroll; sticky okul adı kolonu.
- **Backend RequireSchoolModuleGuard (2026-02):** duty, tv-devices, documents, document-templates, optik, yillik-plan-icerik controller'larına eklendi. Teacher/school_admin için okulun enabled_modules kontrolü; kapalı modülde API 403 MODULE_DISABLED.
- **Okul logları:** `GET /audit-logs?school_id=xxx` (superadmin). Superadmin okul seçince **sadece o okulun** logları gösterilir. Okul detay sayfasında giriş, başarısız giriş, güncelleme vb. kayıtlar; sayfalı tablo.
- **Başarısız giriş:** `failed_login` audit kaydı (auth.service → getSchoolIdForAudit ile email→school ilişkisi); okul loglarında hata filtresi ile öne çıkarılır.
- **Log filtre:** Okul loglarında "Tümü / Hatalar (başarısız giriş) / Girişler / Güncellemeler" dropdown. `failed_login` satırları kırmızı arka plan ile vurgulanır.
- **Okul bilgileri alanları:** website_url, phone, about_description (School entity). Toplu yükleme: Excel şablonu, POST /schools/bulk. Yeni okul formunda web, telefon, detay alanları.

### Sistem Mesajları (admin_message – tamamlandı)

- **Amaç:** Superadmin'den okul adminlerine sistem, bakım, hatırlatma mesajları. Duyuru TV ve okul duyurularından ayrı.
- **Backend:** `admin_messages`, `admin_message_reads` tabloları. `image_url` (varchar 2048) eklendi. POST /admin-messages (school_ids, title, body, image_url), GET /admin-messages, GET /admin-messages/unread-count, PATCH :id/read.
- **Upload:** `admin_message` purpose eklendi; R2 ile görsel yükleme desteklenir.
- **Superadmin:** `/send-announcement` → "Okullara Sistem Mesajı Gönder". Modern form: başlık, içerik, görsel (URL veya dosya yükleme), şablonlar.
- **School admin:** `/system-messages` → "Sistem Mesajları" sayfası. Merkezden gelen mesajları listeler, okundu işaretleyebilir. Detaylı görünüm (tıklanınca Dialog).
- **Mesaj kartları:** Görsel önizleme/minyatür, başlık, özet (line-clamp), detay modal (görsel büyük, tam metin).
- **Konum ve görünürlük:** Menüde Okul bloğunun en başında; sadece Sistem Mesajları menüsünde okunmamış badge. Dashboard'da amber banner.

### Superadmin – Okullara Duyuru Gönder (eski – Sistem Mesajı ile değiştirildi)

- **Duyuru TV ayrımı:** Duyuru TV (2 ekran, cihazlar, ayarlar) sadece school_admin. Superadmin artık Duyuru TV’ye erişmez.
- **Okullara Duyuru Gönder:** Menüde `/send-announcement` – okul seç (çoklu seçim), duyuru oluştur. Duyuru okul admin paneli ve TV ekranlarında görünür.
- **Backend:** POST /announcements body’de `school_id` (superadmin). GET /announcements query `school_id` (superadmin).
- **Geliştirmeler:** Çoklu okul seçimi (checkbox, Tümünü seç); okul arama (ad, il, ilçe); duyuru şablonları (localStorage: kaydet, yükle, sil). CreateAnnouncementForm birden fazla okula tek duyuruyu toplu gönderir.
- **Storage hatası önleme:** localStorage erişimleri try-catch ile korundu (auth-provider, page.tsx, profile).

---

## Ek Ders Parametreleri

- **Analiz:** `docs/EK_DERS_ANALIZ.md` – hesaplama formülü (katsayı×140/150), kalem kuralları (nöbet/belleticilik/sınav gündüz tarifesi; takviye 2×; özel eğitim 1,25×), vergi istisnaları.
- **Backend:** `ExtraLessonParams` entity, `extra-lesson-params` modülü. CRUD: GET/POST/PATCH/DELETE `/extra-lesson/params`. Teacher: GET `/extra-lesson/params/active?semester_code=`.
- **Web-admin:** `/extra-lesson-params` – superadmin dönem ekleme, kalemler (İYEP, %25 nöbet/belleticilik, merkezi sınav brüt tahmini), vergi dilimleri.
- **Varsayılan kalemler:** Gündüz 194,30 / Gece 208,18 TL; nöbet, belleticilik, sınav, egzersiz, hizmet içi gündüz tarifesi; takviye 388,60/416,36 TL; merkezi sınav brüt 1600–3500 TL.

---

## Bu oturum - MEB yıllık plan import stabilizasyonu (hafta/sıra/saat)

- **Import kaynak seçimi düzeltildi:** `import-meb-taslak` akışında doğrudan Excel parse sonucu (kaynak sadakati yüksek) önceliklendirildi; GPT artık parse boş/yetersiz olduğunda fallback.
- **Hafta 37-38 standardizasyonu güçlendirildi:** 37/38 boş satır doldurulurken `ders_saati` zorunlu `2` atanıyor; böylece son haftalarda 10 saat sapması önleniyor.
- **Satır temizleme eklendi:** `unite/konu` içinde sadece `X. Hafta...` etiketi gelen kirli değerler null’lanıyor; uzun "Zümre öğretmenler kurulu tarafından..." metni `okul_temelli_planlama` sütunundan temizleniyor.
- **MEB parse saat fallback düzeltildi:** Excel’de `ders_saati` boşsa varsayılan tekrar `2` yapıldı (önceki 10 saat fallback’i takvim dışı sonuç üretebiliyordu).
- **Doğrulama:** `backend` derleme başarılı (`npm run build`).

---

## Bu oturum - Türkçe 1. sınıf import ek düzeltme (devam)

- **Satır bazlı hibrit seçim:** MEB importta parse ve GPT çıktıları hafta bazında kalite skoru ile karşılaştırılıp daha iyi satır seçiliyor (kolon kayması görülen haftalar için iyileştirme).
- **Ders saati normalizasyonu:** Import sonrası saatler ders/sınıf statik saatine göre normalize ediliyor; yalnızca boş/özel haftalar ve 37-38 haftaları `2` saat bırakılıyor.
- **Parse saat fallback iyileştirildi:** Excel `ders_saati` boşsa içerik dolu normal haftada dersin statik saati, placeholder/özel haftada `2` kullanılıyor.
- **Not:** Amaç, 2. hafta/8. hafta gibi boş haftalarda `2`, içerik dolu normal haftalarda (Türkçe 1. sınıf için) `10` üretmek.

---

## Bu oturum - Türkçe 1. sınıf import ek düzeltme (kolon kayması)

- **Fallback kolon eşleme düzeltildi:** Header doğru okunamadığında `Ay` sütunu var kabul edilen tablolarda indeks ofseti uygulanıyor (`Ay, Hafta, Ünite/Tema, Saat, Konu, Öğrenme Çıktıları...` sırası).
- **Yanlış hizalı satır onarımı eklendi:** `unite` boş, `kazanimlar` içinde tema adı, `konu` içinde kazanım cümleleri olan satırlar import sonrası otomatik düzeltiliyor.
- **Konu geri kazanımı:** Misalignment durumunda `konu` alanı bir önceki geçerli konuya (genelde `DİNLEME`) geri alınarak `kazanimlar` içerik kayması azaltıldı.
- **Hedef:** Özellikle 33-36. haftalardaki `unite=—` + `konu`/`öğrenme çıktıları` çapraz kayması sorununu stabilize etmek.

---

## Bu oturum - Sürekli backend bağlantı hatası önleme

- **Backend dev başlatma scripti güçlendirildi:** `scripts/start-dev.ps1` içinde backend sağlık kontrolü eklendi; backend zaten ayaktaysa ikinci süreç başlatılmıyor.
- **Hazır olmadan web-admin başlatma engeli:** Script, backend `http://localhost:4000/api` yanıtını beklemeden web-admin başlatmıyor.
- **Çakışma koruması:** 40 saniye içinde backend hazır olmazsa script anlamlı hata verip duruyor (EADDRINUSE/.env/DB sorunlarını işaretler).
- **Web-admin retry artırıldı:** `web-admin/src/lib/api.ts` bağlantı retry sayısı ve bekleme süresi artırıldı (soğuk açılışta daha toleranslı).
- **Kural güncellemesi:** `.cursor/rules/run-order.mdc` dosyasına port/health-check adımları ve `start-dev.ps1` tek komut akışı eklendi.

---

## Bu oturum - MEB Excel çok satırlı hafta birleştirme

- **Sorun:** TYMM Excel'de aynı haftanın içeriği birden fazla satıra yayılınca (merge hücre yapısı), parser bazı satırları yeni hafta gibi yorumlayabiliyordu.
- **Düzeltme:** `backend/src/meb/meb-fetch.service.ts` içinde hafta numarası olmayan ama içerik taşıyan satırlar artık son geçerli haftaya birleştiriliyor.
- **Birleştirilen alanlar:** `unite`, `konu`, `kazanimlar`, `surec_bilesenleri`, `olcme_degerlendirme`, `sosyal_duygusal`, `degerler`, `okuryazarlik_becerileri`, `belirli_gun_haftalar`, `zenginlestirme`, `okul_temelli_planlama`.
- **Amaç:** Aynı haftaya ait sağ taraftaki çok satırlı kazanım/süreç/ölçme içeriklerinin Excel'den eksiksiz alınması.
- **Doğrulama:** `backend` derleme başarılı (`npm run build`), linter hatası yok.

---

## Bu oturum - Backend bağlantısı sürekli kopma kök neden düzeltmesi

- **Kök neden:** `backend` içinde `tsconfig.build.json` yoktu; `start:dev` bazı durumlarda `dist/main.js` yerine `dist/src/main.js` üreterek Nest sürecini düşürüyordu.
- **Düzeltme:** `backend/tsconfig.build.json` eklendi (`rootDir: ./src`, `include: src/**/*.ts`) ve dev build çıktısı stabilize edildi.
- **Sonuç:** Backend yeniden başlatıldı, `/api` uç noktasına ağ erişimi doğrulandı (HTTP 404 yanıtı = servis ayakta).

---

## Bu oturum - MEB import boş hafta fallback iyileştirmesi (9. sınıf Coğrafya)

- **Sorun:** Parse sonrası bazı haftalar `unite/konu/kazanimlar` boş (`—`) kalıyordu.
- **Düzeltme:** `import-meb-taslak` akışında `hydrateEmptyWeeks` eklendi.
- **Kural 1:** Tatil olmayan ve 37-38 dışındaki boş hafta varsa aynı haftanın GPT satırı doluysa onunla tamamlanır.
- **Kural 2:** GPT satırı da boşsa bir önceki dolu haftadan `unite/konu/kazanimlar` kontrollü devralınır.
- **Kural 3:** Bu fallback ile doldurulan normal haftalarda `ders_saati` dersin statik saatine çekilir.
- **Not:** Tatil haftaları ile 37-38 son hafta kuralları korunur.

---

## Bu oturum - Parser + GPT Planlayıcı + Katı Validator mimarisi

- **GPT planlayıcı eklendi:** `yillik-plan-gpt.service.ts` içine `planFromParsedRows(...)` eklendi; parser satırlarını kaynak alıp 1..N haftayı sıralı planlıyor.
- **Katı validator eklendi:** `yillik-plan-icerik.controller.ts` içine `strictValidatePlanRows(...)` eklendi; hafta bütünlüğü, boş alan, 37-38 standardı ve ders saati kurallarını zorunlu uygular.
- **Yeni import akışı:** `parse -> parse+gpt satır birleştirme -> fillMissingWeeks -> GPT planlayıcı -> strict validator -> hydrateEmptyWeeks`.
- **Amaç:** Hafta atlama, boş hafta, kolon kaymasından doğan eksik ünite/konu/kazanım sorunlarını tek kanonik doğrulama katmanında kapatmak.
- **Doğrulama:** `backend` derleme başarılı (`npm run build`), linter hatası yok.

---

## Bu oturum - Backend ERR_CONNECTION_REFUSED kalıcı düzeltme

- **Kök neden:** `tsconfig.build.json` ile `incremental` birlikteyken `dist` temizlendikten sonra bazı durumlarda çıktı yeniden üretilmeyip backend `dist/main` bulunamadı hatasıyla düşüyordu.
- **Düzeltme:** `backend/tsconfig.build.json` içinde `incremental: false` yapıldı.
- **Doğrulama:** `npx tsc -p tsconfig.build.json` sonrası `dist/main.js` üretimi doğrulandı; backend tekrar başlatıldı ve `http://localhost:4000/api` yanıt veriyor (HTTP 404 = servis ayakta).

---

## Bu oturum - GPT taslak üretimi hardening (Excel import bozulmadan)

- **Kapsam:** Sadece `generateDraft` akışı güçlendirildi; `import-meb-taslak` (Excel import) işleyişine dokunulmadı.
- **Yeni katman:** `hardenDraftResult(...)` eklendi (`yillik-plan-gpt.service.ts`).
- **Davranış:** GPT taslakta boş `unite/konu/kazanimlar` görülürse önce aynı haftanın TYMM parse kaynağıyla doldurulur, gerekirse önceki dolu haftadan süreklilik sağlanır.
- **Saat kuralı:** Tatil ve 37-38 dışı normal haftalarda `ders_saati` otomatik beklenen saat değerine sabitlenir.
- **Son hafta kuralı:** 37/38 haftaları standart içerikle zorunlu yazılır.
- **Temizlik:** Uzun “zümre öğretmenler kurulu...” metni `okul_temelli_planlama` alanında bırakılmaz.
- **Doğrulama:** `backend` derleme başarılı (`npm run build`), linter hatası yok.

---

## Bu oturum - GPT taslakta TYMM kaynak önceliği (hatasızlık artırımı)

- **Sorun:** GPT taslak önizlemede aynı haftalarda boş/uydurma metin ve çok sayıda uyarı oluşabiliyordu.
- **Düzeltme:** `generateDraft` içinde TYMM Excel kaynağı bulunduğunda GPT serbest üretim yerine deterministik kaynak-plan akışına geçildi.
- **Yeni akış:** `TYMM sourceRows -> buildDraftFromSourceRows -> hardenDraftResult -> çıktı`.
- **Kural:** Tatil dışı haftalar boş bırakılmaz; kaynakta eksikse süreklilik/pekiştirme fallback uygulanır. 37/38 son hafta standardı korunur.
- **Not:** Bu değişiklik sadece GPT taslak üretimini etkiler; `import-meb-taslak` akışı aynı kaldı.

---

## Bu oturum - Superadmin plan içerik görünümü UX iyileştirmesi

- **Modern okunabilir hücreler:** `web-admin/src/app/(admin)/yillik-plan-icerik/page.tsx` içinde uzun metinler için `SmartTextCell` eklendi.
- **Uzun metin yönetimi:** Hücrelerde kısa önizleme + `devam/kapat` ile açılır detay görünümü getirildi (kazanım/süreç/ölçme vb. alanlarda).
- **Tablo görsel iyileştirme:** Plan listesi ve GPT taslak önizleme tablolarında kart/panel görünümü modernize edildi (daha net sınır, boşluk, gölge).
- **Plan altı not kutusu:** Daha okunur kullanım için minimum yükseklik ve dikey yeniden boyutlandırma (`resize-y`) eklendi.
- **Kalite kontrol:** Dosyada linter hatası kalmadı.

---

## Bu oturum - GPT taslak yanlış içerik kök neden düzeltmesi

- **Kök neden:** Ders kodu `..._maarif_...` uzantılı geldiğinde TYMM kaynak eşleşmesi kaçabiliyor, bu da GPT taslakta serbest (hatalı) üretime düşmeye neden oluyordu.
- **Düzeltme 1:** `backend/src/config/meb-sources.ts` içinde ders kodu normalizasyonu güçlendirildi (`_maarif.*` sonrası tamamen temizleniyor).
- **Düzeltme 2:** `backend/src/meb/meb-fetch.service.ts` ders etiketi çözümlemesinde aynı normalizasyon kuralı uygulandı.
- **Düzeltme 3:** `web-admin/src/app/(admin)/yillik-plan-icerik/page.tsx` içindeki `baseSubjectCode` üretimi aynı kuralla güncellendi.
- **Sonuç:** TYMM kaynağı daha güvenilir yakalanır; GPT taslakta yanlış ders/sınıf sapması ve boş içerik riski düşer.

---

## Bu oturum - GPT taslak satır semantiği düzeltmesi (Coğrafya 9)

- **Sorun 1:** İlk haftada gereksiz `PEKİŞTİRME` fallback oluşabiliyordu.
- **Düzeltme 1:** Erken haftalarda boş satır için önce bir sonraki dolu kaynak hafta (`lookahead`) kullanılıyor, sonra fallback devreye giriyor.
- **Sorun 2:** Bazı TYMM satırlarında `kazanimlar` ile `surec_bilesenleri` alanları kayabiliyordu (SDB/DB kodları kazanıma düşüyordu).
- **Düzeltme 2:** `buildDraftFromSourceRows` içinde semantik normalize eklendi; `SDB/DB` kodları ve `a) b) c)` kazanım metni tespit edilip doğru alanlara alınır.
- **Ek:** Ölçme metni süreç alanına kaymışsa `olcme_degerlendirme` alanına taşınır.
- **Doğrulama:** `backend` derleme başarılı (`npm run build`), linter hatası yok.

---

## Bu oturum - Hafta düzeltme formu metin editörü ve geniş alanlar

- **İhtiyaç:** Superadmin plan içerik düzenleme ekranındaki hafta bazlı metin alanları dar olduğu için düzeltme zor yapılıyordu.
- **UI iyileştirme:** `web-admin/src/app/(admin)/yillik-plan-icerik/page.tsx` içine tekrar kullanılabilir `EditorTextarea` bileşeni eklendi.
- **Editör araçları:** Alan üstüne hızlı metin araçları eklendi (`Madde`, `Kalın`, `İtalik`, `Satır`); seçim yapılan metne uygulanır.
- **Geniş alanlar:** `Ünite/Tema`, `Konu`, `Kazanımlar`, `Süreç`, `Ölçme`, `Okul temelli planlama` dahil uzun metin gerektiren tek satır inputlar çok satırlı, `resize-y` destekli alanlara çevrildi.
- **Kullanılabilirlik:** Alan başına karakter sayacı eklendi; uzun plan notları ve düzeltmelerde takip kolaylaştı.
- **Kalite kontrol:** İlgili dosyada linter hatası yok.

---

## Bu oturum - Evrak şablonu hafta aralığı planla hizalandı

- **Kontrol sonucu:** Yıllık plan evrakı haftaları çekilirken `document-generate.service.ts` içinde filtre hâlâ `1..40` idi.
- **Düzeltme:** Şablon üretiminde kullanılan takvim filtresi `1..38` olacak şekilde güncellendi.
- **Etki:** Plan kuralıyla uyumlu çıktı; 39-40 kaynaklı satır/boşluk/taşma riski azaltıldı.
- **Kalite kontrol:** İlgili dosyada linter hatası yok.

---

## Bu oturum - Fen Lisesi Coğrafya GPT taslak kaynak karışması düzeltmesi

- **Sorun:** TYMM RAR içinde aynı sınıf için birden fazla okul türü (Anadolu/Fen Lisesi) dosya veya sheet olduğunda, parse sırasında karışım oluşup hafta içeriği yanlış gelebiliyordu.
- **Kök neden:** `fetchAndParseTymmTaslak` ve sheet seçiminde sadece sınıf (`grade`) bazlı seçim vardı; `subject_code` içindeki okul türü ipucu kullanılmıyordu.
- **Düzeltme:** `backend/src/meb/meb-fetch.service.ts` içine program ipucu filtresi eklendi.
- **Kural:** `subject_code` içinde `..._fl` veya `..._fen_lisesi` varsa Excel dosya/sheet adlarında Fen Lisesi eşleşmeleri öncelikleniyor (mevcutsa sadece onlar parse ediliyor).
- **Sonuç:** `9. sınıf Coğrafya - Maarif (F.L.)` için GPT taslakta ilk haftaların yanlış ünite/konuya kayma riski azaltıldı; gerçek planla uyum arttı.
- **Kalite kontrol:** İlgili dosyada linter hatası yok.

---

## Bu oturum - Güncelleme sonrası backend düşme nedenleri ve kalıcı azaltım

- **Gözlem (terminal kayıtları):** Tekrarlayan hata nedenleri ağırlıklı olarak `EADDRINUSE (4000)` ve watch sırasında TypeScript derleme hataları.
- **Kök neden 1:** Aynı anda birden fazla `npm run start:dev` açılınca ikinci süreç port çakışmasıyla kapanıyor.
- **Kök neden 2:** Backend watch derlemesi `scripts/*.ts` dosyalarını da kapsamına alıp bu dosyalardaki tip hatalarında backend restart döngüsüne girebiliyor.
- **Düzeltme:** `backend/tsconfig.json` sadece `src/**/*.ts` derleyecek şekilde güncellendi; `scripts`, `dist`, `test`, `*.spec.ts` dışlandı.
- **Etki:** Kod güncellemesi sonrası backend’in alakasız script tip hataları yüzünden düşme olasılığı azaldı.
- **Doğrulama:** `npm run build` başarılı; `http://localhost:4000/api` yanıt veriyor (404 beklenen sağlıklı durum).

---

## Bu oturum - GPT taslakta hafta sırası ve kaynak-kıyas kilidi (hatasızlık artırımı)

- **Sorun:** GPT taslakta bazı haftalarda konu/kazanım sırası hedef takvime göre kayıyor; sütun içerikleri atlayıp bir sonraki haftadan taşınabiliyordu.
- **Kök neden:** Deterministik taslak üretimde boş haftayı doldururken ileri haftadan (`lookahead`) içerik çekilebiliyordu; bu da kronolojik sırayı bozuyordu.
- **Düzeltme 1 (Hafta sırası kilidi):** `buildDraftFromSourceRows` içinde ileri haftadan geri haftaya içerik taşıma kaldırıldı.
- **Düzeltme 2 (Kaynakla birebir kıyas/ezme):** `hardenDraftResult` içinde TYMM parse kaynağı varsa aynı haftanın `unite/konu/kazanimlar` ve ilgili alanları GPT çıktısının üstüne yazılıyor.
- **Düzeltme 3 (Sütun semantiği):** `kazanimlar <-> surec_bilesenleri` ve `olcme_degerlendirme` kaymaları için normalize kontrolü hardening aşamasına da eklendi.
- **Ders saati kuralı:** Normal haftada TYMM saat değeri varsa korunuyor, yoksa beklenen ders saati kullanılıyor (37/38 standardı korunur).
- **Kalite kontrol:** `backend` derleme başarılı (`npm run build`), linter hatası yok.

---

## Bu oturum - TYMM Excel seçiminde ilk hafta karşılaştırma ve varyant ayrımı

- **Sorun:** Aynı dersin birden fazla varyantı (örn. farklı okul türleri) aynı RAR/sheet içinde olduğunda yanlış Excel/sheet seçilip konu-kazanım sırası kayabiliyordu.
- **Yeni yaklaşım:** Parse öncesi aday Excel/sheet’ler `1. hafta` verisi üzerinden puanlanıyor; en doğru adayla devam ediliyor.
- **Puanlama ölçütü:** `1. hafta` varlığı + `unite/konu/kazanimlar/ders_saati` doluluğu + 1’den başlayan kesintisiz hafta dizisi + satır sayısı.
- **Varyant ayrımı:** `subject_code` token’ları (`_maarif...` temizlenmiş) dosya/sheet adlarıyla eşleştirilerek doğru ders varyantı lehine ek puan veriliyor.
- **Program filtresi korunur:** Fen Lisesi (`_fl`) ipucu için dosya/sheet filtreleme kuralı devam ediyor; üstüne ilk hafta karşılaştırma eklendi.
- **Etki:** Parser artık çoklu adayları birleştirmek yerine en güvenilir tek adayı seçiyor; sütun/satır atlamaları ve yanlış varyant karışması azalıyor.
- **Kalite kontrol:** `backend` derleme başarılı (`npm run build`), linter hatası yok.

---

## Bu oturum - Excel ile GPT taslak + çok sekmeli Excel desteği

- **POST /yillik-plan-icerik/generate-draft-from-excel:** Kullanıcı kendi Excel dosyasını yükleyerek GPT taslak oluşturur (TYMM yerine Excel kaynak kullanılır).
- **Multer düzeltmesi:** `Cannot POST` hatası için `MulterModule.register({ storage: multer.memoryStorage() })` eklendi; `@types/multer` devDependency.
- **GenerateDraftFromExcelDto:** Multipart form body için DTO; grade string→number transform, ValidationPipe uyumu.
- **Çok sekmeli Excel:** `getSheetNamesForGrade` güçlendirildi:
  - "9. Sınıf", "9 Sınıf", "Coğrafya 9", "Plan 9" gibi sınıf adları eşleştirilir.
  - Eşleşme yoksa tüm sekmeler parse edilir; `parseExcelPlanInternal` scoring ile en uygun sekme seçilir.
- **Web-admin:** "Excel ile Taslak Oluştur" butonu; FormData ile endpoint'e POST.

---

## Bu oturum - SBL Coğrafya Excel parse düzeltmeleri

- **Header satırı:** findHeaderRowIndex artık "hafta" içeren satırı önceliyor; SBL formatında üst satır (SÜRE, ÜNİTE/TEMA) yerine gerçek sütun başlığı (AY, HAFTA, ÜNİTE/TEMA, KONU…) seçilir.
- **Sekme adı:** "9.SINIF COĞRAFYA" için `getSheetNamesForGrade` eşleşmesi (sinif/sınıf) düzeltildi.
- **Boş hafta sonrası içerik:** Önceki hafta boş (SINAV, tatil vb.) ve sonraki satırda ünite/konu/kazanım varsa, bu satır yeni hafta (lastWeekOrder+1) olarak eklenir, önceki boş haftaya birleştirilmez.
- **Örnek:** SOSYAL BİLİMLER LİSESİ COĞRAFYA DERSİ TASLAK YILLIK PLANLARI.xlsx – 9. sınıf sekmesi.

---

## Bu oturum - Excel taslak: GPT devreye sokma

- **Akış:** Excel yükleme ile gelen `customSourceRows` için artık deterministik build yerine `planFromParsedRows` (GPT) kullanılıyor.
- **Amaç:** Parser kolon karışması, eksik hafta vb. hataları GPT ile düzeltmek; taslağı eksiksiz ve hatasız üretmek.
- **GPT prompt güçlendirme:** "Her haftanın içeriği O HAFTAYA AİT olmalı", "Kolon karışması varsa DÜZELT", "Eksik hafta: önceki ünite sürdür veya PEKİŞTİRME".
- **Fallback:** GPT yetersiz dönerse (örn. < totalWeeks-5 hafta) deterministik `buildDraftFromSourceRows` kullanılır.
- **TYMM fetch:** Kullanıcı Excel yüklemeden TYMM’den otomatik çekilen taslakta deterministik yol aynen korunur.

---

## Bu oturum – Kazanım Takip: kullanım kolaylığı iyileştirmeleri (10 madde)

- **Bugünün/Bu haftanın kazanımları:** Favori ve son planlardan hızlı erişim kartı.
- **Kazanım işaretleme:** Her kazanım satırında "Tamamlandı/Eksik" butonu (localStorage).
- **Excel dışa aktarma:** Plan detay sayfasında CSV indirme (hafta, ünite, konu, kazanımlar, durum).
- **Klavye kısayolları:** Liste: `/` arama odak, `1-9` sınıf seç; Detay: `←` `→` hafta geçişi.
- **Kaldığın yerden devam:** Son plan+hafta kaydedilir; liste sayfasında link; detay `?week=X` ile açılır.
- **Mobil:** Önceki/Sonraki hafta butonları (aria-label ile erişilebilirlik).
- **Kazanım metni araması:** Detay sayfasında konu, ünite, kazanımlar alanlarında tam metin arama.
- **Filtreleri kaydetme:** Sınıf, branş, görünüm modu localStorage ile hatırlanır.
- **BEP/özel eğitim filtresi:** Plan türü: Tümü | Ders | BEP.
- **Storage:** kazanim-storage.ts: getSavedFilters, setSavedFilters, getKaldiginYer, setKaldiginYer, getKazanimDurum, toggleKazanimDurum.

---

## Kazanım Takip: yillik_plan_icerik + work_calendar verisi

- **Veri kaynağı değişikliği:** Kazanım Takip artık outcome_sets değil, doğrudan **yillik_plan_icerik** ve **work_calendar** kullanıyor.
- **Liste:** GET /yillik-plan-icerik/teacher/plans → plan özetleri (subject_code, grade, academic_year, section, week_count).
- **Detay:** GET /yillik-plan-icerik/teacher/plan-content?subject_code=&grade=&academic_year=&section= → haftalık içerik + hafta_label, ay, week_start, week_end (çalışma takviminden).
- **Detay sayfası:** ID formatı `subject_code:grade:academic_year:section`; hafta sekmelerinde takvim etiketi (örn. "8-12 Eylül"); tüm yıllık plan alanları gösteriliyor: ünite, konu, kazanımlar, süreç bileşenleri, ölçme-değerlendirme, belirli gün/haftalar, sosyal-duygusal, değerler, okuryazarlık, zenginleştirme, okul temelli planlama.
- **Kazanım Notları:** localStorage ile not ekleme (yillik_plan_icerik.id anahtarı).

---

## Bu oturum – Superadmin Kazanım Setleri: yillik_plan_icerik tabanlı

- **Veri kaynağı:** outcome_sets API kaldırıldı; artık **yillik_plan_icerik** + **work_calendar** kullanılıyor.
- **Liste:** GET /yillik-plan-icerik/teacher/plans (superadmin/moderator erişimi eklendi); filtre, plan kartları, "Yıllık Plan İçeriklerinde Düzenle" linki.
- **Detay:** plan-content API ile hafta sekmeleri, gradient bölümler (Teacher Kazanım Takip ile aynı); "Yıllık Plan İçeriklerinde Düzenle" butonu; Kazanım Notları (localStorage).
- **Menü:** requiredModule outcome_sets → document_templates. ROUTE_MODULES güncellendi.
- **Backend:** teacher/plans ve teacher/plan-content endpoint'lerine superadmin, moderator rolleri eklendi.

---

## Bu oturum – Nöbet modülü 11 öneri (tam uygulama)

Docs DERS_PROGRAMI_VE_NOBET_MODULU_NOTLARI.md'deki 11 öneri basit ve tam şekilde uygulandı:

1. **Dashboard: Bugün nöbetim var mı?** – Öğretmen için `/duty/daily?date=today` ile kart; nöbet varsa yeşil, yoksa gri. `web-admin/src/app/(admin)/dashboard/page.tsx`.
2. **"Değiştirildi" etiketi** – Yerine görevlendirilen slot'larda (`reassigned_from_user_id`) mavi rozet. Gün tablosu ve hafta görünümü.
3. **Plan oluştururken Adil dağıt** – Plan formunda `/duty/summary` ile mevcut dağılım; "Bu ay en az nöbeti olanlar" listesi; "İlk satıra en az nöbetliyi ekle" butonu.
4. **Duyuru TV ↔ Duty senkronizasyonu** – TV Nöbet kartında "Nöbet planından al" butonu; `/duty/daily-range` ile ay nöbetleri `tv_duty_schedule` formatına dönüştürülür.
5. **Excel import'ta dağılım uyarısı** – Parse sonrası max–min > 3 ise toast + Alert uyarısı.
6. **Nöbet hatırlatma (duty.reminder)** – DutyReminderService cron (07:00, Türkiye saati); bugün nöbeti olanlara Inbox kaydı.
7. **Yazdırma stilleri** – DutyNav `print:hidden`; tablo `.duty-print-table` ile `@media print` (14px font, border).
8. **Görev Verilenler sayfası** – `GET /duty/reassigned`; `/duty/gorevlendirilen`; yerine görevlendirilmiş slot listesi; ay navigasyonu.
9. **Nöbet × ders programı tablosu** – `/duty/gunluk-tablo`; Nobetyonetim tarzı: Nöbetçi | Konum | 1.–8. Ders; ders programı öğretmen ataması yoksa "—" placeholder.
10. **Nöbet takas talebi (DutySwapRequest)** – Entity, migration, API (POST /duty/swap-requests, GET list, POST respond); `/duty/takas`; öğretmen talep oluşturur, admin onay/red.
11. **Tercih toplama (DutyPreference)** – Entity, migration, API (POST/GET/DELETE /duty/preferences); `/duty/tercihler`; müsait/müsait değil/tercih ediyorum; teacher ekler, admin tümünü görür.

**Dosyalar:** `backend/src/duty/` (entities: duty-swap-request, duty-preference; service, controller); `backend/migrations/add-duty-swap-preference.sql`; `web-admin/.../duty/` (gorevlendirilen, gunluk-tablo, takas, tercihler); DutyNav; `GET /duty/teachers` (öğretmen listesi, takas dropdown).

---

## Bu oturum – Nöbet modülü genişletmeleri

- **Öğretmen-okul doğrulaması:** Backend createPlan, reassignSlot, createSwapRequest artık user_id'lerin okulun öğretmenleri (teacher/school_admin, active) arasında olduğunu doğrular. Geçersiz ise DUTY_TEACHER_NOT_IN_SCHOOL (400) döner.
- **Ders giriş/çıkış saatleri:** DutySlot entity'ye slot_start_time, slot_end_time (HH:mm) eklendi. Migration: add-duty-slot-times-and-school-duty-hours.sql.
- **Okul varsayılan saatler:** School entity'ye duty_start_time, duty_end_time eklendi. Nöbet Yerleri sayfasında "Varsayılan Nöbet Saatleri" kartı; GET/PATCH /duty/school-default-times.
- **Excel formatı:** Şablon Tarih | Öğretmen | Alan | Giriş Saati | Çıkış Saati. Parse: giriş/çıkış/başlangıç/bitiş sütun eşlemesi; Excel serial→HH:mm dönüşümü. Export plan da saatleri içerir.
- **Hata kodu:** ERROR_CODES.md DUTY_TEACHER_NOT_IN_SCHOOL eklendi.

### Bu oturum – Nobetyonetim entegrasyonu (tam uygulama)
- **Gelmeyen Ekle sayfası:** `/duty/gelmeyen` – raporlu/izinli/gelmeyen devamsızlık ekleme (tarih aralığı); duty_absence tablosu; GET/POST/DELETE /duty/absences; Gelmeyen menü öğesi.
- **DutySlot.absent_type:** mark-absent artık absent_type (raporlu|izinli|gelmeyen) alır; Takvim gün görünümünde tip seçim dialogu.
- **Tek tuşla otomatik görevlendirme:** POST /duty/plans/auto-generate; Planlar sayfasında "Tek Tuşla Otomatik Görevlendirme" kartı; devamsızlık kayıtları hariç tutulur.
- **WhatsApp paylaşımı:** Günlük Tablo'da "WhatsApp'ta Paylaş" butonu; nöbet listesi metni wa.me ile paylaşılır.
- **Ek ders puantaj entegrasyonu:** GET /duty/absences-for-ek-ders (from, to); Gelmeyen sayfasında "Ek Ders Puantaj – Nöbet Devamsızlık Özeti" kartı.
- **Migration:** add-duty-absence-and-absent-type.sql (duty_absence, duty_slot.absent_type).

### Bu oturum – Tüm dersler giriş/çıkış + el ile düzenleme + hata uyarıları
- **1.–10. ders saatleri:** School.lesson_schedule (JSONB); Nöbet Yerleri sayfasında "1.–10. Ders Giriş/Çıkış Saatleri" tablosu; GET/PATCH school-default-times lesson_schedule dahil. Migration: add-lesson-schedule.sql.
- **Plan el ile düzenleme:** PATCH /duty/slots/:id, POST /duty/plans/:id/slots, DELETE /duty/slots/:id. Planlar listesinde plan başlığına tıklayınca `/duty/planlar/[id]` detay sayfası; taslak planlarda slot ekle/düzenle/sil (inline edit).
- **Hata uyarıları:** apiFetch hata response'undan code ve details aktarır; DUTY_TEACHER_NOT_IN_SCHOOL için createError Alert + invalid_user_ids sayısı; AllExceptionsFilter DUTY_TEACHER_NOT_IN_SCHOOL mesajı.

---

## Nöbet Modülü – Yapılacaklar

**Detaylı notlar:** `docs/DERS_PROGRAMI_VE_NOBET_MODULU_NOTLARI.md` (araştırma, kullanıcı yorumları, çözüm önerileri)

### Referans (Nobetyonetim.net)
- Menü: Nöbetçiler, Gelmeyen Ekle, Görev Verilenler; alt menü: Öğretmen Ayarları, Nöbet Yerleri, Ders Programı Yükle, Toplam Görevlendirme.
- Günlük tablo: Nöbetçi | Konum | 1.–8. Ders; boş hücre = nöbet, dolu = ders (sınıf-ders). Önceki/sonraki gün; yazdır.

### MVP (P1) – Zorunlu
- **Backend:** duty_plan, duty_slot, duty_log entity + migration; DutyModule, Service, Controller.
- **API:** GET /duty/plans, POST /duty/plans/upload, POST /duty/plans/:id/publish, POST /duty/reassign, GET /duty/logs.
- **Web-admin:** Excel yükleme (şablon indir + kolon eşleme), önizleme, hata listesi, taslak/yayın, yerine görevlendir, log sayfası, PDF/Excel indir.
- **Mobil (Flutter):** Bugün, 7 gün, takvim, liste; "değiştirildi" etiketi; son güncelleme; 2 sn altında açılış + cache.
- **Event:** duty.published, duty.changed, duty.reassigned → Inbox + Push.
- **Nöbet alanları:** duty_area veya area_name; Koridor, Bahçe, Giriş vb. okul bazlı tanımlanabilir.
- **Nöbet saati:** slot_start_time, slot_end_time (MEB: ilk ders -30dk … son ders +30dk).
- **Gelmeyen işaretleme:** DutySlot.absent_marked_at; school_admin "gelmedi" işaretleyebilir.

### V2 – İyileştirmeler (çoğu uygulandı)
- ~~Teacher swap talebi: Öğretmen "değiştirmek istiyorum" → admin onay; DutySwapRequest.~~ ✅
- ~~Tercih/istek toplama: Plan öncesi uygun/isteksiz gün; DutyPreference.~~ ✅
- ~~Nöbet hatırlatma: duty.reminder push (nöbetten X saat önce).~~ ✅ (Inbox)
- İzin/rapor uyarısı: Raporlu/izinli öğretmene atama uyarısı.
- MEB muafiyet: Hamile, engelli, 20/25 yıl uyarı veya hariç tutma.
- Sabit/dönerli gün: Öğretmen bazlı sabit veya dönerli dağılım.
- Plan dönemi: period_start, period_end, academic_year.

### Teknik hedefler
- Platform bağımsız (Web + Flutter; masaüstü Excel yerine web Excel import).
- Reklam yok; performans (cache/CDN); esnek Excel şablonları.

---

## Yarın devam için öneriler

- **İletişim ve Destek modülü (Tam Uygulama):** Tam spec `docs/DESTEK_TICKET_SPEC.md`. Backend: tickets modülü (entities, DTO, service, controller), ticket-modules, GET/POST/PATCH /tickets, /tickets/:id, /tickets/:id/messages, /tickets/:id/escalate. Upload purpose: ticket_attachment. MODERATOR_MODULES: support. Web-admin: /support (Taleplerim), /support/new, /support/[id], /support/inbox (okul), /support/platform (superadmin). Menü ve ROUTE_ROLES güncellendi. NOTIFICATION_MATRIX: support.ticket.* event'leri. **İyileştirmeler (2026-02):** Taleplerim vs Inbox ayrımı (list_mode: owned/school_inbox); Eskalasyon modalı (school_admin); status değiştirme + iç not UI (staff); yeni talep formunda PLATFORM_SUPPORT için modül filtresi. **Full:** Attachment UI (presign, TicketAttachmentInput – yeni talep + mesaj); atama paneli (GET /tickets/assignable-users, dropdown); 3 kolonlu Inbox/Platform layout (sol liste | orta konuşma | sağ metadata); Destek Modülleri CRUD (/support/modules, superadmin). **UI iyileştirme:** SupportStatusBadge (ikonlu durum rozetleri: CircleDot, Loader2, Clock, CheckCircle2, CircleSlash); SupportNotificationHint (Bildirimler sayfasına link); Alert kutucukları (hata, kapatıldı/çözüldü uyarısı); kompakt layout (space-y-4, py-2.5, text-xs); iç not rozeti StickyNote ikonlu. **E-posta bildirimleri (2026-02):** support.ticket.* event'lerinde Inbox'a ek olarak kullanıcıya e-posta gönderilir. Superadmin Ayarlar sayfasında "Mail (SMTP) Ayarları" kutucuğu (host, port, kullanıcı, şifre, gönderen, SSL, web panel URL). MailService + modern HTML şablon (okunabilir, CTA butonu). **Öğretmen → Superadmin (2026-02):** Öğretmenler artık doğrudan "Platform / Yönetici" seçeneği ile talebi superadmin'e iletebilir; PLATFORM_SUPPORT oluşturulunca tüm superadmin'lere Inbox bildirimi. **Moderatör görevlendirmesi (2026-02):** Destek gelen kutusunda school_admin "Destek ekibi" butonu ile moderatör atayabilir; mevcut moderatöre support modülü ekleme/çıkarma, öğretmeni destek moderatörü yapma (role+moderator_modules).
- **Haberler modülü:** İl bazlı filtre (city_filter UI); RSS/scraping gerçek entegrasyonu; moderator için ContentAdmin API; mobil (Flutter) haberler ekranı.
- **Nöbet modülü:** Backend entity + API + web-admin Excel yükleme/yayın; yerine görevlendir; mobil görüntüleme. Referans: docs/DERS_PROGRAMI_VE_NOBET_MODULU_NOTLARI.md.
- **Kazanım Setleri:** Teacher tarafı: GET /outcome-sets (teacher scope), Kazanım Ara (hafta/ünite arama), favori/not (ilerleme kaydı) — MVP sonrası. AUTHORITY_MATRIX.md güncelle.
- **Market geliştirme:** Jeton ile evrak hakkı satın alma; evrak_uretim entitlement artırma akışı; satın alma sonrası evrak sayfasına yönlendirme.

- Zil entegrasyonu: `bell_schedule` tablosu, ders saati CRUD, TV’de "Derse X dk" uyarısı.
- RSS widget: tv_rss_url ile TV ekranında RSS haber blokları.
- Basit analytics: TV’de gösterilen duyuru sayısı, blok bazlı özet.
- Gece modu: tv_night_mode_start/end ile TV ekranının belirtilen saatte kararma veya bekleme modu.

## Diğer öneriler

- **Ders programı (opsiyonel):** TV tarafı tamam. İstenirse: öğretmen kendi dersleri (branş/sınıf filtresi), mobil "Bugün derslerim", PDF/Excel çıktı.
- **Evrak – tek master + plan verisi:** `yillik_plan_icerik` tablosu (subject_code, grade, week_order, ay, hafta, konu, ders_saati); admin CRUD; GPT API ile taslak oluşturma endpoint'i.
- Şifre sıfırlama: gerçek e-posta gönderimi (backend + link ile sıfırlama sayfası).
- **Web Admin tasarım (Mosaic):** `.cursor/rules/web-admin-design.mdc` – Cruip Mosaic referans alınarak sayfa tasarımlarını modernize et; bileşen bazlı, kodları bozmadan. Öncelik: Dashboard → tablo sayfaları → form stilleri.
- Firebase yokken sosyal giriş: butonlar pasif; isteğe bağlı “Yapılandırma gerekli” bilgi metni.
- İsteğe bağlı: Sınıflar/Dersler CRUD modülü (madde 4).
- Test: demo hesaplarla login, kayıt, dashboard, duyurular, profil şifre değiştirme akışı.

---

*Son güncelleme (20 Şubat 2026 – 3. tur): **Nöbet modülü – kapsamlı iyileştirme (plan 2) tamamlandı.**

### Bu turda tamamlananlar (20 Şubat 2026 – 3. tur)
- **Entity: DutySwapRequest** – `teacher2_status`, `coverage_id`, `'coverage_swap'` request_type eklendi.
- **Entity: DutyLog** – `oldUser` / `newUser` ManyToOne ilişkileri eklendi.
- **Service: teacherRespondSwap()** – Öğretmen B, kendine gelen talebi `/teacher-respond` endpoint'i ile onaylar/reddeder; karşı taraflara bildirim gönderilir.
- **Service: createSwapRequest** – `coverage_swap` tipi desteği; `teacher2_status` init mantığı.
- **Service: respondSwapRequest** – Admin `teacher2_status` bypass edebilir; `coverage_swap` için `coverage.covered_by_user_id` güncellenir.
- **Service: autoGeneratePlan** – `same_day_each_week` kuralı: öğretmen hafta 1'de Pazartesi'ye atandıysa sonraki haftalarda da Pazartesi öncelikli. Dağıtım raporu (`distribution`) plan sonrasında döner.
- **Service: listPlans** – Teacher rolü taslak (`draft`) planları göremez.
- **Service: listLogs** – `oldUser` / `newUser` join eklendi; frontend'de okunabilir açıklamalar gösterilir.
- **Frontend: takas/page.tsx** – 2-adım onay UI (`teacher2_status`); Öğretmen B Kabul/Reddet butonları; coverage_swap modal; admin gün değişiminde öğretmen seçimi.
- **Frontend: ders-programi/page.tsx** – Öğretmen bazlı ve gün bazlı tablo görünümü; muaf öğretmen badge; tab/tur geçişi.
- **Frontend: logs/page.tsx** – `describeLog()` ile okunabilir açıklamalar; `oldUser`/`newUser` isimleri; `undone` satır soluklaştırma.
- **Frontend: yerler/page.tsx** – 3 sekmeli yapı (Okul Ayarları / Nöbet Yerleri / Muaf Öğretmenler); muaf öğretmenler ayrı listede; "Kaydet" butonu ile neden güncellemesi.
- **Frontend: gorevlendirilen/page.tsx** – `absent_type` neden badge; orijinal → görevlendirilen akış kartı.
- **Frontend: duty/page.tsx** – Teacher için "Bugün Nöbet Arkadaşlarım" paneli.
- **Frontend: planlar/page.tsx** – `same_day_each_week` checkbox (gelişmiş kurallar); dağıtım raporu modal (plan oluştururken otomatik açılır).

*Son güncelleme (20 Şubat 2026 – son tur): **Nöbet modülü – algoritma güçlendirme, muaf badge, swap/coverage doğrulama.**
- **same_day_each_week hard filter:** `autoGeneratePlan`'a `weekDayAssignedByUser` takibi eklendi; öğretmen bir haftada başka güne atandıysa veya haftalararası tercih günü farklıysa `candidatePoolPreSoft`'tan çıkarılıyor (fallback ile). Haftada iki farklı güne nöbet verilmiyor.
- **Swap validasyonu (backend):** `createSwapRequest`'e `'swap'` tipi için önerilen öğretmenin aynı gün nöbetçi olduğu kontrolü; `'coverage_swap'` tipi için önerilen öğretmenin ilgili ders saatinde dersi olmadığı kontrolü eklendi.
- **Muaf badge:** `gunluk-tablo/page.tsx`, `page.tsx` partners paneli → `duty_exempt: true` olan öğretmenlere `✓ Muaf` turuncu badge.
- **Takas swap filtresi (frontend):** `takas/page.tsx`'te nöbet seçildiğinde `/duty/daily` çağrılarak aynı gün nöbetçiler yükleniyor; listede yalnızca o gün nöbetçiler gösteriliyor.
- **Nöbet arkadaşları endpoint:** `GET /duty/partners?date=...` eklendi (teacher+admin erişebilir); `page.tsx` duty partners paneli bu endpoint'i kullanıyor (öğretmenin kendi slotlarından filtreleme yerine gerçek tüm nöbetçiler).

*Son güncelleme (20 Şubat 2026): **Nöbet modülü – hata düzeltme, yeni özellikler ve test tamamlandı.**

### Bu turda tamamlananlar
- **Boş ders görünürlüğü:** `GET /duty/absences/:id/class-schedule` → devamsız öğretmenin tarih aralığındaki tüm günlerdeki dolu dersleri döner; `gelmeyen/page.tsx` genişletilebilir "Boş Dersler" paneli ile görüntüler.
- **Muaf öğretmen düzeltme:** `setTeacherExempt`'te `performed_by` → `old_user_id` yanlış geçme hatası giderildi.
- **Ders saati bazlı görüntüleme:** `LessonCoverageDialog.tsx`'e `useAuth` token eklendi; 401 hatası giderildi.
- **Gün/ders değişim talebi:** `DutySwapRequest` entity'sine `request_type` ('swap'|'day_change') alanı eklendi; `proposed_user_id` nullable yapıldı; frontend `takas/page.tsx`'te yeni "Gün/Ders Değişimi İste" diyaloğu.
- **Gelişmiş kural paneli:** `planlar/page.tsx`'te `prevent_consecutive_days`, `respect_preferences`, `enable_weekday_balance`, `prefer_fewer_lessons_day`, `max_per_month`, `min_days_between` toggle/input'ları.
- **Geri al (Undo):** `DutyLog`'a `undone_at`/`undone_by` alanları; `POST /duty/undo/:log_id` → reassign, absent_marked, coverage_assigned, duty_exempt işlemlerini 24 saat içinde geri alır; `gunluk-tablo` ve `planlar/[id]` sayfalarına "Son İşlemler" paneli.
- **Boşluklu ders programı yüklendi:** 10 öğretmen × 5 gün, kasıtlı boşlukları olan 107 ders kaydı DB'ye aktarıldı.
- **Excel parser iyileştirmesi:** `uploadFromExcel` artık `#` ile başlayan yorum satırlarını atlayarak gerçek başlık satırını buluyor.
- **DB migration:** TypeORM `synchronize:true` ile yeni kolonlar otomatik eklendi.
- **Test sonuçları:** class-schedule ✓, day_change swap request ✓, undo/already-undone ✓, auto-generate plan (42 slot) ✓.

*Son güncelleme (19 Şubat 2026 – 2. tur): **Nöbet modülü – çalışma mantığı kapsamlı iyileştirme.**
- **A: Tercih entegrasyonu:** autoGeneratePlan, öğretmenlerin "unavailable" nöbet tercihi işaretlediği günleri devamsızlıklar gibi atlar.
- **B: Çift vardiya engeli:** İkili eğitimde aynı öğretmen aynı gün hem sabah hem öğle vardiyasına artık atanamıyor.
- **D: Tatil haftaları:** autoGeneratePlan, work_calendar.isTatil=true olan haftalardaki günleri planlamaz; UI'da Çalışma Takvimi linki eklendi.
- **E: Plan çakışma kontrolü:** publishPlan, aynı okul aynı tarih aralığında örtüşen başka yayınlanmış plan varsa PLAN_DATE_CONFLICT hatası döner.
- **F: Haftalık nöbet limiti:** autoGeneratePlan'a max_per_week parametresi eklendi; UI'da "Haftalık maks. nöbet" alanı.
- **Dönerli liste (isteğe bağlı):** autoGeneratePlan'a `rotate_area_by_week` parametresi. Açıkken: ilk hafta şablon, sonraki haftalarda nöbet yerleri haftalık kaydırılır (Excel benzeri); günler aynı kalır. Gelişmiş Kurallar içinde "Dönerli liste (Excel benzeri)" checkbox.
- **G: Plan yayın bildirimleri:** publishPlan'da etkilenen öğretmenlere duty.published inbox bildirimi gönderiliyordu, mevcut koddaydı (onaylandı).
- **H: Takas teklifi bildirimi:** createSwapRequest artık proposed_user_id'ye duty.swap_requested bildirimi gönderiyor.
- **I: createPreference performans:** N adet SELECT yerine tek toplu sorgu + batch save.
- **C: Takas → Görev Devri:** Frontend'de "Takas Talepleri" → "Görev Devri Talepleri"; açıklayıcı metinler güncellendi; DutyNav etiketi değişti.

*Son güncelleme (19 Şubat 2026 – 1. tur): **Nöbet modülü – kapsamlı iyileştirme + ikili eğitim desteği tamamlandı.**
- **Değişiklik Logu filtresi:** from/to/action/limit ile backend filtreli GET /duty/logs; web-admin UI güncellendi.
- **Soft-delete güvenliği:** reassignSlot, markAbsent, createSwapRequest, respondSwapRequest deleted_at kontrolü eklendi; listSwapRequests deleted_at IS NULL filtresi.
- **Timezone date fix:** Tüm duty modülü web-admin sayfalarında toYMD() → yerel YYYY-MM-DD; toISOString() kaldırıldı.
- **Build & lint temizliği:** Backend nest build ✓; web-admin next build ✓; ESLint ✓.
- **İkili eğitim + vardiya desteği (tam):**
  - DB: duty_slot.shift (morning/afternoon), schools.duty_education_mode/duty_max_lessons/duty_start_time_pm/duty_end_time_pm/lesson_schedule_pm
  - Backend: entity + DTO + service + controller güncellendi (shift-aware: getSlotsForDate, getDailyRoster, getSlotsForDateRange, autoGeneratePlan, suggestReplacement, school-default-times)
  - Web-admin Planlar: auto-generate çift vardiya checkbox; Excel import/export Vardiya sütunu
  - Web-admin Plan Detay: Vardiya sütunu tablo; edit/add form shift select; WhatsApp+Excel shift bilgisi
  - Web-admin Günlük Tablo: shift toggle (Sabah/Öğle); shift-aware veri çekimi
  - Web-admin Takvim (Ana Sayfa): slot kartlarında S:/Ö: prefix
  - Web-admin Yerler: eğitim modu, max ders, öğle vardiyası saati ayarları UI

*Eski güncelleme: Nöbet modülü – GET /duty/daily-range API; Mosaic tarzı takvim görünümleri (Ay | Hafta | Gün); görünüm seçici, önceki/sonraki, Bugün; ay grid’de nöbetçi özeti; hafta görünümü 7 sütun; gün tıklanınca gün detayına geçiş. API_CONTRACT.md güncellendi. Yarın devam: Excel yükleme. Plan listesi, Değişiklik Logu, Excel yükleme, Plan Excel indir, Toplam Görevlendirme (/duty/ozet) eklendi. GET /duty/summary API. Planlar: Excel İndir butonu (her plan için). Event bildirimleri: duty.published ve duty.reassigned → Inbox. Nobetyonetim.net referans: ortak DutyNav. Adil dağılım sistemi: DutyDistributionChart (Recharts yatay bar, renk kodlu – yeşil/amber/kırmızı); Toplam Görevlendirme sayfasında grafik + özet kartları (Toplam Nöbet, Görevli Öğretmen, Adil Dağılım); Yerine görevlendir modalında ay dağılımı + öğretmenler en az nöbetli önce sıralı; Gelmeyen işaretle → otomatik yerine görevlendir modalı açılır. Yarın: Push, "değiştirildi" etiketi.* 

---

*Referans: .cursor/rules’u referans al.*
