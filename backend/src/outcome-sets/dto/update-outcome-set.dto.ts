import { IsString, IsInt, IsOptional, Min, Max } from 'class-validator';

export class UpdateOutcomeSetDto {
  @IsOptional()
  @IsString()
  subject_code?: string;

  @IsOptional()
  @IsString()
  subject_label?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  grade?: number;

  @IsOptional()
  @IsString()
  section?: string | null;

  @IsOptional()
  @IsString()
  academic_year?: string | null;

  @IsOptional()
  items?: Array<{
    id?: string;
    week_order?: number | null;
    unite?: string | null;
    code?: string | null;
    description: string;
    sort_order?: number;
  }>;
}
