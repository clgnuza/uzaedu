import { IsString, IsOptional, IsBoolean, MaxLength, IsInt, Min, IsDateString, IsUUID } from 'class-validator';

export class CreateAnnouncementDto {
  /** Superadmin: Hangi okula duyuru gönderileceği. Zorunlu sadece superadmin için. */
  @IsOptional()
  @IsUUID()
  school_id?: string;
  @IsString()
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsString()
  summary?: string | null;

  @IsOptional()
  @IsString()
  body?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  importance?: string;

  /**
   * İçerik tipi; Duyuru TV ekranı için segmentasyon.
   * Örn: general, special_day, principal_message, staff, info_bank, birthday, success, timetable, duty, meal, ticker, ...
   */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  category?: string;

  /**
   * Bu duyuru Duyuru TV ekranında da gösterilsin mi?
   */
  @IsOptional()
  @IsBoolean()
  show_on_tv?: boolean;

  /**
   * TV ekranında konum ipucu (opsiyonel): middle | bottom | right | ticker vb.
   */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  tv_slot?: string;

  /**
   * Duyuru TV hedef ekranı:
   * - all: Tüm ekranlar (koridor + öğretmenler + tahta)
   * - both: Koridor + öğretmenler odası
   * - corridor: Sadece koridor
   * - teachers: Sadece öğretmenler odası
   * - classroom: Sadece Akıllı Tahta
   */
  @IsOptional()
  @IsString()
  @MaxLength(16)
  tv_audience?: string;

  @IsOptional()
  @IsBoolean()
  publish?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  attachment_url?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  youtube_url?: string | null;

  /** Video slaytı: true ise slayt video bitene kadar ilerlemez. */
  @IsOptional()
  @IsBoolean()
  tv_wait_for_video_end?: boolean;

  @IsOptional()
  @IsInt()
  @Min(3)
  tv_slide_duration_seconds?: number | null;

  @IsOptional()
  @IsDateString()
  scheduled_from?: string | null;

  @IsOptional()
  @IsDateString()
  scheduled_until?: string | null;
}
