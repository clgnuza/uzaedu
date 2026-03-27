import { IsOptional, IsString, IsInt, IsBoolean, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class ListDocumentTemplatesDto {
  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  sub_type?: string;

  @IsOptional()
  @IsString()
  school_type?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  grade?: number;

  @IsOptional()
  @IsString()
  section?: string;

  @IsOptional()
  @IsString()
  subject_code?: string;

  @IsOptional()
  @IsString()
  academic_year?: string;

  /** Örn. bilsem — BİLSEM yıllık plan şablonları */
  @IsOptional()
  @IsString()
  curriculum_model?: string;

  /** Bu müfredat değerine sahip şablonları listeden çıkar (MEB listesinde bilsem ayrımı) */
  @IsOptional()
  @IsString()
  exclude_curriculum_model?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const v = value.trim().toLowerCase();
      if (v === 'true') return true;
      if (v === 'false') return false;
    }
    return value;
  })
  @IsBoolean()
  active_only?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
