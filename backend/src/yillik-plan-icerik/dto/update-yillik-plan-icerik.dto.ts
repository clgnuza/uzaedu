import { IsString, IsOptional, IsNumber, MaxLength } from 'class-validator';

export class UpdateYillikPlanIcerikDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  subject_code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  subject_label?: string;

  @IsOptional()
  @IsNumber()
  grade?: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  ana_grup?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  alt_grup?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  section?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  academic_year?: string;

  @IsOptional()
  @IsNumber()
  week_order?: number;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  unite?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  konu?: string;

  @IsOptional()
  @IsString()
  kazanimlar?: string;

  @IsOptional()
  @IsNumber()
  ders_saati?: number;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  belirli_gun_haftalar?: string;

  @IsOptional()
  @IsString()
  surec_bilesenleri?: string;

  @IsOptional()
  @IsString()
  olcme_degerlendirme?: string;

  @IsOptional()
  @IsString()
  sosyal_duygusal?: string;

  @IsOptional()
  @IsString()
  degerler?: string;

  @IsOptional()
  @IsString()
  okuryazarlik_becerileri?: string;

  @IsOptional()
  @IsString()
  zenginlestirme?: string;

  @IsOptional()
  @IsString()
  okul_temelli_planlama?: string;

  @IsOptional()
  @IsNumber()
  sort_order?: number;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  curriculum_model?: string;
}
