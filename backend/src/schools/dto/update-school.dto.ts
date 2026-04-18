import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  IsIn,
  IsArray,
  IsBoolean,
  Min,
  Max,
  MaxLength,
  Matches,
  ValidateIf,
  IsEmail,
  ArrayMaxSize,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MARKET_MODULE_KEYS } from '../../app-config/market-policy.defaults';
import { SchoolSegment, SchoolStatus, SchoolType } from '../../types/enums';
import { ReviewPlacementScoreRowDto } from './review-placement-score-row.dto';

export class UpdateSchoolDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsEnum(SchoolType)
  type?: SchoolType;

  @IsOptional()
  @IsEnum(SchoolSegment)
  segment?: SchoolSegment;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  district?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  website_url?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  fax?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v != null && String(v).trim() !== '')
  @IsString()
  @Matches(/^\d{4,16}$/, { message: 'MEB kurum kodu yalnızca rakam ve 4–16 hane olmalıdır.' })
  institution_code?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v != null && String(v).trim() !== '')
  @IsEmail({}, { message: 'Geçerli bir e-posta girin.' })
  @MaxLength(256)
  institutional_email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  address?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  map_url?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  school_image_url?: string | null;

  @IsOptional()
  @IsString()
  about_description?: string | null;

  @IsOptional()
  @IsEnum(SchoolStatus)
  status?: SchoolStatus;

  @IsOptional()
  @IsInt()
  @Min(1)
  teacher_limit?: number;

  @IsOptional()
  @IsIn(['none', 'automatic', 'manual'])
  teacher_name_merge_mode?: 'none' | 'automatic' | 'manual';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  tv_weather_city?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  tv_welcome_image_url?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  tv_youtube_url?: string | null;

  @IsOptional()
  @IsInt()
  @Min(3)
  tv_default_slide_duration?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  tv_rss_url?: string | null;

  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(300)
  tv_rss_marquee_duration?: number | null;

  @IsOptional()
  @IsInt()
  @Min(12)
  @Max(48)
  tv_rss_marquee_font_size?: number | null;

  @IsOptional()
  @IsInt()
  @Min(20)
  @Max(120)
  tv_ticker_marquee_duration?: number | null;

  @IsOptional()
  @IsInt()
  @Min(14)
  @Max(36)
  tv_ticker_font_size?: number | null;

  @IsOptional()
  @IsIn(['uppercase', 'lowercase', 'none'])
  tv_ticker_text_transform?: 'uppercase' | 'lowercase' | 'none' | null;

  @IsOptional()
  @IsString()
  @MaxLength(5)
  tv_night_mode_start?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5)
  tv_night_mode_end?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  tv_logo_url?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  tv_card_position?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  tv_logo_position?: string | null;

  @IsOptional()
  @IsString()
  @IsIn(['small', 'medium', 'large'])
  tv_logo_size?: 'small' | 'medium' | 'large' | null;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  tv_theme?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  tv_primary_color?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  tv_visible_cards?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  tv_countdown_card_title?: string | null;

  @IsOptional()
  @IsInt()
  @Min(14)
  @Max(48)
  tv_countdown_font_size?: number | null;

  @IsOptional()
  @IsIn(['bullet', 'pipe', 'dash'])
  tv_countdown_separator?: 'bullet' | 'pipe' | 'dash' | null;

  /** Geri sayım hedefleri JSON: [{label:string, target_date: string (ISO)}] */
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  tv_countdown_targets?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  tv_meal_card_title?: string | null;

  @IsOptional()
  @IsInt()
  @Min(14)
  @Max(48)
  tv_meal_font_size?: number | null;

  /** Yemek menüsü JSON: {schedule_type, entries:[{day_of_week?, date?, title, menu}]} */
  @IsOptional()
  @IsString()
  @MaxLength(8192)
  tv_meal_schedule?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  tv_duty_card_title?: string | null;

  @IsOptional()
  @IsInt()
  @Min(14)
  @Max(48)
  tv_duty_font_size?: number | null;

  /** Nöbetçi listesi JSON: {schedule_type, entries:[{day_of_week?, date?, title, info}]} */
  @IsOptional()
  @IsString()
  @MaxLength(8192)
  tv_duty_schedule?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  tv_gunun_sozu_rss_url?: string | null;

  @IsOptional()
  @IsInt()
  @Min(14)
  @Max(36)
  tv_gunun_sozu_font_size?: number | null;

  @IsOptional()
  @IsInt()
  @Min(20)
  @Max(300)
  tv_gunun_sozu_marquee_duration?: number | null;

  @IsOptional()
  @IsIn(['uppercase', 'lowercase', 'none'])
  tv_gunun_sozu_text_transform?: 'uppercase' | 'lowercase' | 'none' | null;

  /** Belirli Gün ve Haftalar takvimi: { entries: [{ date, title, responsible, description? }] } */
  @IsOptional()
  @IsString()
  @MaxLength(16384)
  tv_special_days_calendar?: string | null;

  /** Ders programı grid: { lesson_times, class_sections, entries } */
  @IsOptional()
  @IsString()
  @MaxLength(65536)
  tv_timetable_schedule?: string | null;

  /** true: TV ders programı okul yayınlanmış plandan; false: sadece tv_timetable_schedule */
  @IsOptional()
  @IsBoolean()
  tv_timetable_use_school_plan?: boolean | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  tv_birthday_card_title?: string | null;

  @IsOptional()
  @IsInt()
  @Min(14)
  @Max(48)
  tv_birthday_font_size?: number | null;

  /** Öğrenci/öğretmen doğum günü takvimi: { entries: [{ date, name, type, class_section? }] } */
  @IsOptional()
  @IsString()
  @MaxLength(65536)
  tv_birthday_calendar?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  tv_now_in_class_bar_title?: string | null;

  @IsOptional()
  @IsInt()
  @Min(14)
  @Max(48)
  tv_now_in_class_bar_font_size?: number | null;

  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(180)
  tv_now_in_class_bar_marquee_duration?: number | null;

  /** TV erişim IP kısıtlaması. Virgülle ayrılmış IP veya önek (örn. 85.123.45.67, 192.168.1.). Boş = kısıtlama yok. */
  @IsOptional()
  @IsString()
  @MaxLength(512)
  tv_allowed_ips?: string | null;

  /** Akıllı Tahta: Kroki plan görseli URL (tek plan, eski). */
  @IsOptional()
  @IsString()
  @MaxLength(512)
  smart_board_floor_plan_url?: string | null;

  /** Akıllı Tahta: Çoklu kat planları [{ label, url }]. */
  @IsOptional()
  @IsArray()
  smart_board_floor_plans?: { label: string; url: string }[];

  /** Akıllı Tahta: Tüm öğretmenlere otomatik yetki (yetkili listesine eklemeden bağlanabilir). */
  @IsOptional()
  @IsBoolean()
  smart_board_auto_authorize?: boolean;

  /** Akıllı Tahta: Bağlantı timeout dakika (1-30). Heartbeat gelmezse oturum sonlanır. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  smart_board_session_timeout_minutes?: number;

  /** Akıllı Tahta: Öğretmen sadece ders verdiği sınıfların tahtalarına bağlansın. */
  @IsOptional()
  @IsBoolean()
  smart_board_restrict_to_own_classes?: boolean;

  /** Akıllı Tahta: İdare bağlantıyı sonlandırdığında öğretmene Inbox bildirimi gönderilir. */
  @IsOptional()
  @IsBoolean()
  smart_board_notify_on_disconnect?: boolean;

  /** Akıllı Tahta: Ders saati bitince otomatik bağlantı kesilir (lesson_schedule gerekli). */
  @IsOptional()
  @IsBoolean()
  smart_board_auto_disconnect_lesson_end?: boolean;

  /** Nöbet modülü: Varsayılan nöbet başlangıç saati (HH:mm). Örn: 08:00 */
  @IsOptional()
  @IsString()
  @MaxLength(5)
  duty_start_time?: string | null;

  /** Nöbet modülü: Varsayılan nöbet bitiş saati (HH:mm). Örn: 15:30 */
  @IsOptional()
  @IsString()
  @MaxLength(5)
  duty_end_time?: string | null;

  /** Okula açık modüller. null = tüm modüller. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsIn([...MARKET_MODULE_KEYS], { each: true })
  enabled_modules?: string[] | null;

  /** Nöbet tebliği: Öğretmenlere nöbet görevi tebliği şablonu */
  @IsOptional()
  @IsString()
  duty_teblig_duty_template?: string | null;

  /** Nöbet tebliği: Yerine görevlendirme tebliği şablonu */
  @IsOptional()
  @IsString()
  duty_teblig_coverage_template?: string | null;

  /** Okul değerlendirme: merkezî (LGS) + yerel yerleştirme göstergesi kartı (süperadmin). */
  @IsOptional()
  @IsBoolean()
  review_placement_dual_track?: boolean;

  /** Son 4 yıl; with_exam=merkezî LGS tabanı, without_exam=yerel gösterge; null = veriyi sil */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => ReviewPlacementScoreRowDto)
  review_placement_scores?: ReviewPlacementScoreRowDto[] | null;

  /** v2 LGS/OBP infografik JSON; null = sil */
  @IsOptional()
  @IsObject()
  review_placement_charts?: Record<string, unknown> | null;
}
