import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class BilsemPlanSubmissionWeekItemDto {
  @IsInt()
  @Min(1)
  @Max(38)
  week_order!: number;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  unite?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  konu?: string | null;

  @IsOptional()
  @IsString()
  kazanimlar?: string | null;

  /** Word şablonunda ogrenme_ciktilari; boşsa kazanimlar kullanılır. */
  @IsOptional()
  @IsString()
  @MaxLength(32000)
  ogrenme_ciktilari?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(40)
  ders_saati?: number;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  belirli_gun_haftalar?: string | null;

  @IsOptional()
  @IsString()
  surec_bilesenleri?: string | null;

  @IsOptional()
  @IsString()
  olcme_degerlendirme?: string | null;

  @IsOptional()
  @IsString()
  sosyal_duygusal?: string | null;

  @IsOptional()
  @IsString()
  degerler?: string | null;

  @IsOptional()
  @IsString()
  okuryazarlik_becerileri?: string | null;

  @IsOptional()
  @IsString()
  zenginlestirme?: string | null;

  @IsOptional()
  @IsString()
  okul_temelli_planlama?: string | null;
}

export class CreateBilsemPlanSubmissionDto {
  @IsString()
  @MaxLength(64)
  subject_code!: string;

  @IsString()
  @MaxLength(128)
  subject_label!: string;

  @IsString()
  @MaxLength(64)
  ana_grup!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  alt_grup?: string | null;

  @IsString()
  @MaxLength(16)
  academic_year!: string;

  @IsInt()
  @Min(1)
  @Max(12)
  plan_grade!: number;

  @IsOptional()
  @IsString()
  tablo_alti_not?: string | null;

  /** Haftalar: JSON dizi veya yapıştırılan UTF-8 CSV (başlık satırı zorunlu). Dolu ise `items` yerine kullanılır. */
  @IsOptional()
  @IsString()
  @MaxLength(500000)
  items_import?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BilsemPlanSubmissionWeekItemDto)
  items?: BilsemPlanSubmissionWeekItemDto[];
}
