import { IsString, IsOptional, IsBoolean, IsNumber, IsDateString, MaxLength } from 'class-validator';

export class UpdateWorkCalendarDto {
  @IsOptional()
  @IsString()
  @MaxLength(16)
  academic_year?: string;

  @IsOptional()
  @IsNumber()
  week_order?: number;

  @IsOptional()
  @IsDateString()
  week_start?: string;

  @IsOptional()
  @IsDateString()
  week_end?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  ay?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  hafta_label?: string;

  @IsOptional()
  @IsBoolean()
  is_tatil?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  tatil_label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  sinav_etiketleri?: string;

  @IsOptional()
  @IsNumber()
  sort_order?: number;
}
