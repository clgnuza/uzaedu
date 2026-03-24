import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { SchoolSegment, SchoolStatus, SchoolType } from '../../types/enums';
import { User } from '../../users/entities/user.entity';

@Entity('schools')
export class School {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 32 })
  type: SchoolType;

  @Column({ type: 'varchar', length: 32 })
  segment: SchoolSegment;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  district: string | null;

  /** Müdür adı – evrak form merge için (zümre, tutanak, dilekçe) */
  @Column({ name: 'principal_name', type: 'varchar', length: 128, nullable: true })
  principalName: string | null;

  /** Okul web sitesi URL (örn. https://okul.meb.gov.tr) */
  @Column({ type: 'varchar', length: 512, nullable: true })
  website_url: string | null;

  /** İletişim telefonu (örn. 0312 555 00 00) */
  @Column({ type: 'varchar', length: 32, nullable: true })
  phone: string | null;

  /** Belgegeçer (faks) numarası */
  @Column({ type: 'varchar', length: 32, nullable: true })
  fax: string | null;

  /** MEB kurum kodu (devlet okulları için zorunlu) */
  @Column({ name: 'institution_code', type: 'varchar', length: 16, nullable: true })
  institutionCode: string | null;

  /** Kurumsal e-posta (örn. info@okuladi.meb.k12.tr) */
  @Column({ name: 'institutional_email', type: 'varchar', length: 256, nullable: true })
  institutionalEmail: string | null;

  /** Okul tam adresi (mahalle, cadde, no, ilçe/il) */
  @Column({ type: 'varchar', length: 512, nullable: true })
  address: string | null;

  /** Google Haritalar linki (yol tarifi veya konum paylaşım) */
  @Column({ name: 'map_url', type: 'varchar', length: 1024, nullable: true })
  mapUrl: string | null;

  /** Okul logosu veya tanıtım fotoğrafı URL (Okul Tanıtım, profil vb.) */
  @Column({ name: 'school_image_url', type: 'varchar', length: 512, nullable: true })
  schoolImageUrl: string | null;

  /** Okulumuz Hakkında – detaylı tanıtım metni */
  @Column({ type: 'text', nullable: true })
  about_description: string | null;

  @Column({ type: 'varchar', length: 32, default: SchoolStatus.deneme })
  status: SchoolStatus;

  @Column({ type: 'int', default: 100 })
  teacher_limit: number;

  /** Okul Değerlendirme: detay sayfası görüntülenme sayısı */
  @Column({ type: 'int', default: 0 })
  review_view_count: number;

  /**
   * Okula açık modüller. null/boş = tüm modüller açık.
   * Örnek: ["duty", "tv", "extra_lesson", "document", "outcome", "optical", "smart_board", "school_profile"]
   */
  @Column({ type: 'jsonb', nullable: true })
  enabled_modules: string[] | null;

  /** Duyuru TV: Otomatik hava durumu için şehir (örn. Antalya). Boşsa manuel duyuru kullanılır. */
  @Column({ type: 'varchar', length: 100, nullable: true })
  tv_weather_city: string | null;

  /** Duyuru TV: Hoş geldin slaytı arka plan / tanıtım görseli URL. */
  @Column({ type: 'varchar', length: 512, nullable: true })
  tv_welcome_image_url: string | null;

  /** Duyuru TV: Sağ panelde veya slaytta gösterilecek YouTube embed URL (örn. https://youtube.com/watch?v=xxx). */
  @Column({ type: 'varchar', length: 512, nullable: true })
  tv_youtube_url: string | null;

  /** Duyuru TV: Varsayılan slayt süresi (saniye). 0 ise yok sayılır. */
  @Column({ type: 'int', nullable: true })
  tv_default_slide_duration: number | null;

  /** Duyuru TV: RSS haber kaynağı URL. */
  @Column({ type: 'varchar', length: 512, nullable: true })
  tv_rss_url: string | null;

  /** Duyuru TV: RSS alt bandı kayma süresi (saniye). Daha yüksek = daha yavaş. Varsayılan 90. */
  @Column({ type: 'int', nullable: true })
  tv_rss_marquee_duration: number | null;

  /** Duyuru TV: RSS alt bandı yazı boyutu (px). Varsayılan 18. */
  @Column({ type: 'int', nullable: true })
  tv_rss_marquee_font_size: number | null;

  /** Duyuru TV: Sarı bar (okul duyuruları) kayma süresi (saniye). Varsayılan 45. */
  @Column({ type: 'int', nullable: true })
  tv_ticker_marquee_duration: number | null;

  /** Duyuru TV: Sarı bar yazı boyutu (px). Varsayılan 18. */
  @Column({ type: 'int', nullable: true })
  tv_ticker_font_size: number | null;

  /** Duyuru TV: Sarı bar yazı tipi – uppercase | lowercase | none. Türkçe için uygun. */
  @Column({ type: 'varchar', length: 16, nullable: true })
  tv_ticker_text_transform: string | null;

  /** Duyuru TV: Gece modu başlangıç saati (HH:mm). Boşsa kapalı. */
  @Column({ type: 'varchar', length: 5, nullable: true })
  tv_night_mode_start: string | null;

  /** Duyuru TV: Gece modu bitiş saati (HH:mm). Boşsa kapalı. */
  @Column({ type: 'varchar', length: 5, nullable: true })
  tv_night_mode_end: string | null;

  /** Duyuru TV: Okul logosu URL (sol üst 3D alan). */
  @Column({ type: 'varchar', length: 512, nullable: true })
  tv_logo_url: string | null;

  /** Duyuru TV: Yan kart konumu – left | right. */
  @Column({ type: 'varchar', length: 8, nullable: true })
  tv_card_position: string | null;

  /** Duyuru TV: Logo konumu – left | right. */
  @Column({ type: 'varchar', length: 8, nullable: true })
  tv_logo_position: string | null;

  /** Duyuru TV: Logo büyüklüğü – small | medium | large. Varsayılan medium. */
  @Column({ type: 'varchar', length: 8, nullable: true })
  tv_logo_size: string | null;

  /** Duyuru TV: Tema – dark | light | school. */
  @Column({ type: 'varchar', length: 16, nullable: true })
  tv_theme: string | null;

  /** Duyuru TV: Okul rengi (hex, school teması için). */
  @Column({ type: 'varchar', length: 16, nullable: true })
  tv_primary_color: string | null;

  /** Duyuru TV: Görünecek kartlar (virgülle ayrılmış). Boşsa hepsi gösterilir. */
  @Column({ type: 'varchar', length: 256, nullable: true })
  tv_visible_cards: string | null;

  /** Duyuru TV: Sayaç kartı başlığı. Boşsa varsayılan. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  tv_countdown_card_title: string | null;

  /** Duyuru TV: Sayaç yazı boyutu (px). Varsayılan 28. */
  @Column({ type: 'int', nullable: true })
  tv_countdown_font_size: number | null;

  /** Duyuru TV: Birden fazla sayaç arası ayırıcı. bullet | pipe | dash */
  @Column({ type: 'varchar', length: 16, nullable: true })
  tv_countdown_separator: string | null;

  /**
   * Duyuru TV: Geri sayım hedefleri. JSON: [{label:"Sınav",target_date:"2025-06-15T09:00:00.000Z"},...]
   */
  @Column({ type: 'text', nullable: true })
  tv_countdown_targets: string | null;

  /** Duyuru TV: Yemek kartı başlığı. Boşsa varsayılan. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  tv_meal_card_title: string | null;

  /** Duyuru TV: Yemek kartı yazı boyutu (px). */
  @Column({ type: 'int', nullable: true })
  tv_meal_font_size: number | null;

  /**
   * Duyuru TV: Yemek menüsü. JSON: {schedule_type:"weekly"|"by_date", entries:[{day_of_week?:1-7, date?:"YYYY-MM-DD", title, menu}]}
   */
  @Column({ type: 'text', nullable: true })
  tv_meal_schedule: string | null;

  /** Duyuru TV: Nöbetçi kartı başlığı. Boşsa varsayılan. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  tv_duty_card_title: string | null;

  /** Duyuru TV: Nöbetçi kartı yazı boyutu (px). */
  @Column({ type: 'int', nullable: true })
  tv_duty_font_size: number | null;

  /**
   * Duyuru TV: Nöbetçi listesi. JSON: {schedule_type:"weekly"|"by_date", entries:[{day_of_week?:1-7, date?:"YYYY-MM-DD", title, info}]}
   */
  @Column({ type: 'text', nullable: true })
  tv_duty_schedule: string | null;

  /** Duyuru TV: Günün Sözü alt bar – RSS URL (sözler otomatik çekilir). */
  @Column({ type: 'varchar', length: 512, nullable: true })
  tv_gunun_sozu_rss_url: string | null;

  /** Duyuru TV: Günün Sözü alt bar yazı boyutu (px). */
  @Column({ type: 'int', nullable: true })
  tv_gunun_sozu_font_size: number | null;

  /** Duyuru TV: Günün Sözü alt bar kayma hızı (saniye). */
  @Column({ type: 'int', nullable: true })
  tv_gunun_sozu_marquee_duration: number | null;

  /** Duyuru TV: Günün Sözü alt bar yazı tipi – uppercase | lowercase | none. */
  @Column({ type: 'varchar', length: 16, nullable: true })
  tv_gunun_sozu_text_transform: string | null;

  /**
   * Duyuru TV: Belirli Gün ve Haftalar takvimi. JSON: { entries: [{ date: "YYYY-MM-DD", title, responsible, description? }] }
   */
  @Column({ type: 'text', nullable: true })
  tv_special_days_calendar: string | null;

  /**
   * Duyuru TV: Ders programı grid. JSON: {
   *   lesson_times: [{ num, start, end }],
   *   class_sections: ["1A","1B",...],
   *   entries: [{ day, lesson, class, subject }]
   * }
   */
  @Column({ type: 'text', nullable: true })
  tv_timetable_schedule: string | null;

  /** Duyuru TV: Doğum günü kartı başlığı. Boşsa varsayılan. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  tv_birthday_card_title: string | null;

  /** Duyuru TV: Doğum günü kartı yazı boyutu (px). Varsayılan 24. */
  @Column({ type: 'int', nullable: true })
  tv_birthday_font_size: number | null;

  /**
   * Duyuru TV: Öğrenci/öğretmen doğum günü takvimi. JSON: {
   *   entries: [{ date: "YYYY-MM-DD", name, type: "teacher"|"student", class_section?: string }]
   * }
   */
  @Column({ type: 'text', nullable: true })
  tv_birthday_calendar: string | null;

  /** Duyuru TV: Şuan Derste alt bar başlığı. Boşsa "Şuan Derste". */
  @Column({ type: 'varchar', length: 64, nullable: true })
  tv_now_in_class_bar_title: string | null;

  /** Duyuru TV: Şuan Derste alt bar yazı boyutu (px). Varsayılan 18. */
  @Column({ type: 'int', nullable: true })
  tv_now_in_class_bar_font_size: number | null;

  /** Duyuru TV: Şuan Derste alt bar kayma süresi (saniye). Varsayılan 30. */
  @Column({ type: 'int', nullable: true })
  tv_now_in_class_bar_marquee_duration: number | null;

  /**
   * Duyuru TV: Sadece bu IP'lerden erişilebilir. Virgülle ayrılmış (örn. 85.123.45.67 veya 192.168.1.).
   * Boş = tüm IP'lerden erişim (varsayılan).
   */
  @Column({ type: 'varchar', length: 512, nullable: true })
  tv_allowed_ips: string | null;

  /** Akıllı Tahta: Kroki plan görseli URL (eski, tek plan). Geriye uyumluluk için. */
  @Column({ name: 'smart_board_floor_plan_url', type: 'varchar', length: 512, nullable: true })
  smartBoardFloorPlanUrl: string | null;

  /** Akıllı Tahta: Çoklu kat planları. [{ label: string, url: string }] */
  @Column({ name: 'smart_board_floor_plans', type: 'jsonb', nullable: true })
  smartBoardFloorPlans: { label: string; url: string }[] | null;

  /** Akıllı Tahta: Tüm öğretmenlere otomatik yetki. true = yetkili listesine eklemeden bağlanabilir. */
  @Column({ name: 'smart_board_auto_authorize', type: 'boolean', default: false })
  smartBoardAutoAuthorize: boolean;

  /** Akıllı Tahta: Bağlantı timeout (dakika). Heartbeat gelmezse oturum sonlanır. 1-30. */
  @Column({ name: 'smart_board_session_timeout_minutes', type: 'int', default: 2 })
  smartBoardSessionTimeoutMinutes: number;

  /** Akıllı Tahta: Öğretmen sadece ders verdiği sınıfların tahtalarına bağlansın. */
  @Column({ name: 'smart_board_restrict_to_own_classes', type: 'boolean', default: false })
  smartBoardRestrictToOwnClasses: boolean;

  /** Akıllı Tahta: İdare bağlantıyı sonlandırdığında öğretmene Inbox bildirimi gönderilir. */
  @Column({ name: 'smart_board_notify_on_disconnect', type: 'boolean', default: true })
  smartBoardNotifyOnDisconnect: boolean;

  /** Akıllı Tahta: Ders saati bitince heartbeat sırasında otomatik bağlantı kesilir (lesson_schedule gerekli). */
  @Column({ name: 'smart_board_auto_disconnect_lesson_end', type: 'boolean', default: false })
  smartBoardAutoDisconnectLessonEnd: boolean;

  /** Nöbet modülü: Varsayılan nöbet başlangıç saati (HH:mm). Örn: 08:00 – ilk ders -30 dk. */
  @Column({ name: 'duty_start_time', type: 'varchar', length: 5, nullable: true })
  duty_start_time: string | null;

  /** Nöbet modülü: Varsayılan nöbet bitiş saati (HH:mm). Örn: 15:30 – son ders +30 dk. */
  @Column({ name: 'duty_end_time', type: 'varchar', length: 5, nullable: true })
  duty_end_time: string | null;

  /** Nöbet modülü: Tekli/ikili eğitim. single | double */
  @Column({ name: 'duty_education_mode', type: 'varchar', length: 16, nullable: true })
  duty_education_mode: string | null;

  /** Nöbet modülü: Günlük ders sayısı (6-12). */
  @Column({ name: 'duty_max_lessons', type: 'int', nullable: true })
  duty_max_lessons: number | null;

  /** Nöbet modülü (ikili eğitim): Öğle vardiyası nöbet başlangıç saati (HH:mm). */
  @Column({ name: 'duty_start_time_pm', type: 'varchar', length: 5, nullable: true })
  duty_start_time_pm: string | null;

  /** Nöbet modülü (ikili eğitim): Öğle vardiyası nöbet bitiş saati (HH:mm). */
  @Column({ name: 'duty_end_time_pm', type: 'varchar', length: 5, nullable: true })
  duty_end_time_pm: string | null;

  /**
   * Ders saatleri: 1.-10. ders giriş/çıkış.
   * JSON: [{lesson_num:1, start_time:"08:30", end_time:"09:10"}, ...]
   */
  @Column({ name: 'lesson_schedule', type: 'jsonb', nullable: true })
  lesson_schedule: { lesson_num: number; start_time: string; end_time: string }[] | null;

  /**
   * Ders saatleri (ikili eğitim): Öğle vardiyası 1..N ders giriş/çıkış.
   * JSON: [{lesson_num:1, start_time:"12:30", end_time:"13:10"}, ...]
   */
  @Column({ name: 'lesson_schedule_pm', type: 'jsonb', nullable: true })
  lesson_schedule_pm: { lesson_num: number; start_time: string; end_time: string }[] | null;

  /** Nöbet: Öğretmenlere Görev Devri açık mı. false ise menüde gizlenir/erişim engellenir. */
  @Column({ name: 'duty_teacher_swap_enabled', type: 'boolean', default: true })
  duty_teacher_swap_enabled: boolean;

  /** Nöbet: Öğretmenlere Tercihlerim açık mı. false ise menüde gizlenir/erişim engellenir. */
  @Column({ name: 'duty_teacher_preferences_enabled', type: 'boolean', default: true })
  duty_teacher_preferences_enabled: boolean;

  /** Nöbet tebliği: Öğretmenlere nöbet görevi tebliği şablonu (HTML veya düz metin). Placeholder: {{okul_adi}}, {{tarih}}, {{sayi}}, {{konu}}, {{ogretmen_adi}}, {{nobet_tarihi}}, {{nobet_yeri}}, {{mudur_adi}} */
  @Column({ name: 'duty_teblig_duty_template', type: 'text', nullable: true })
  duty_teblig_duty_template: string | null;

  /** Nöbet tebliği: Yerine görevlendirme tebliği şablonu. Placeholder: {{okul_adi}}, {{tarih}}, {{sayi}}, {{konu}}, {{ogretmen_adi}}, {{gelmeyen_adi}}, {{gorev_tarihi}}, {{ders_saati}}, {{mudur_adi}} */
  @Column({ name: 'duty_teblig_coverage_template', type: 'text', nullable: true })
  duty_teblig_coverage_template: string | null;

  /** Nöbet tebliği: Boş ders görevlendirme paragraf metni (düzenlenebilir). Placeholder: {{okul_adi}}, {{tarih}}, {{konu}}, {{gun_adi}}, {{mudur_adi}} */
  @Column({ name: 'duty_teblig_bos_ders_paragraf', type: 'text', nullable: true })
  duty_teblig_bos_ders_paragraf: string | null;

  /** Nöbet tebliği: Boş ders görevlendirme konu metni (örn. Nöbet Görevi) */
  @Column({ name: 'duty_teblig_bos_ders_konu', type: 'varchar', length: 128, nullable: true })
  duty_teblig_bos_ders_konu: string | null;

  /** Nöbet tebliği: Nöbetçi müdür yardımcısı adı (boş ders görevlendirme belgesi için) */
  @Column({ name: 'duty_teblig_deputy_principal_name', type: 'varchar', length: 128, nullable: true })
  duty_teblig_deputy_principal_name: string | null;

  /** Site haritası okul özelleştirmesi: { hiddenIds: uuid[], customItems: [...] } */
  @Column({ name: 'site_map_overrides', type: 'jsonb', nullable: true })
  site_map_overrides: { hiddenIds?: string[]; customItems?: { id: string; parentId?: string | null; title: string; path: string; description?: string; sortOrder: number }[] } | null;

  /** Akademik takvim okul özelleştirmesi: { hiddenItemIds: uuid[], customItems: [{ weekId, type, title, path?, sortOrder }] } */
  @Column({ name: 'academic_calendar_overrides', type: 'jsonb', nullable: true })
  academic_calendar_overrides: {
    hiddenItemIds?: string[];
    customItems?: { id: string; weekId: string; type: 'belirli_gun_hafta' | 'ogretmen_isleri'; title: string; path?: string; sortOrder: number }[];
  } | null;

  /** BİLSEM takvim okul özelleştirmesi: { hiddenItemIds: uuid[], customItems: [{ weekId, type, title, path?, sortOrder }] } */
  @Column({ name: 'bilsem_calendar_overrides', type: 'jsonb', nullable: true })
  bilsem_calendar_overrides: {
    hiddenItemIds?: string[];
    customItems?: { id: string; weekId: string; type: string; title: string; path?: string; sortOrder: number }[];
  } | null;

  /** Haftalık nöbet çizelgesi: Başlık (örn. HAFTALIK NÖBET ÇİZELGESİ) */
  @Column({ name: 'duty_teblig_haftalik_baslik', type: 'varchar', length: 128, nullable: true })
  duty_teblig_haftalik_baslik: string | null;

  /** Haftalık nöbet çizelgesi: Nöbetçi öğretmenlerin görevleri (her satır 1 madde, numarasız veya "1-" ile başlayabilir) */
  @Column({ name: 'duty_teblig_haftalik_duty_duties_text', type: 'text', nullable: true })
  duty_teblig_haftalik_duty_duties_text: string | null;

  /** Market: okul jeton bakiyesi (kurumsal satın alma) */
  @Column({ name: 'market_jeton_balance', type: 'numeric', precision: 14, scale: 6, default: 0 })
  marketJetonBalance: string;

  /** Market: okul ek ders bakiyesi */
  @Column({ name: 'market_ekders_balance', type: 'numeric', precision: 14, scale: 6, default: 0 })
  marketEkdersBalance: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => User, (u) => u.school)
  users: User[];
}
