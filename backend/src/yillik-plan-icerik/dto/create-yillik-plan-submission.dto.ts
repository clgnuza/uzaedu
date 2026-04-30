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

export class YillikPlanSubmissionWeekItemDto {
  @IsInt()
  @Min(1)
  @Max(38)
  week_order: number;

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

export class CreateYillikPlanSubmissionDto {
  @IsString()
  @MaxLength(64)
  subject_code: string;

  @IsString()
  @MaxLength(128)
  subject_label: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  grade: number;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  section?: string | null;

  @IsString()
  @MaxLength(16)
  academic_year: string;

  @IsOptional()
  @IsString()
  tablo_alti_not?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500000)
  items_import?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => YillikPlanSubmissionWeekItemDto)
  items?: YillikPlanSubmissionWeekItemDto[];
}
