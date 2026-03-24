import { IsString, IsOptional, IsBoolean, IsNumber, IsDateString, MaxLength } from 'class-validator';

export class CreateWorkCalendarDto {
  @IsString()
  @MaxLength(16)
  academic_year!: string;

  @IsNumber()
  week_order!: number;

  @IsDateString()
  week_start!: string;

  @IsDateString()
  week_end!: string;

  @IsString()
  @MaxLength(32)
  ay!: string;

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
