import { IsString, IsOptional, IsInt, IsBoolean, Min, Max } from 'class-validator';

export class UpdateCatalogSubjectDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  grade_min?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  grade_max?: number | null;

  @IsOptional()
  @IsString()
  section_filter?: string | null;

  @IsOptional()
  @IsString()
  ana_grup?: string | null;

  @IsOptional()
  @IsInt()
  sort_order?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
