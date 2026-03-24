import { IsString, IsOptional, IsBoolean, IsUrl, MaxLength, IsInt, Min, IsDateString } from 'class-validator';

export class UpdateAnnouncementDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

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
   */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  category?: string;

  /**
   * Duyuru TV ekranında gösterim bayrağı.
   */
  @IsOptional()
  @IsBoolean()
  show_on_tv?: boolean;

  /**
   * TV ekranı konumu için ipucu.
   */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  tv_slot?: string;

  /**
   * Duyuru TV hedef ekranı.
   */
  @IsOptional()
  @IsString()
  @MaxLength(16)
  tv_audience?: string;

  @IsOptional()
  @IsBoolean()
  publish?: boolean;

  @IsOptional()
  @IsUrl()
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

  /** Acil duyuru override süresi (dakika). 0 veya verilmezse kapatılır. */
  @IsOptional()
  @IsInt()
  @Min(0)
  urgent_override_minutes?: number;

  /** TV slayt süresi (saniye). */
  @IsOptional()
  @IsInt()
  @Min(3)
  tv_slide_duration_seconds?: number | null;

  /** Zamanlanmış gösterim başlangıcı (ISO 8601). */
  @IsOptional()
  @IsDateString()
  scheduled_from?: string | null;

  /** Zamanlanmış gösterim bitişi (ISO 8601). */
  @IsOptional()
  @IsDateString()
  scheduled_until?: string | null;
}
