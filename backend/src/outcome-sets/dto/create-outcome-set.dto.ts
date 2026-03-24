import { IsString, IsInt, IsOptional, Min, Max } from 'class-validator';

export class CreateOutcomeSetDto {
  @IsString()
  subject_code!: string;

  @IsString()
  subject_label!: string;

  @IsInt()
  @Min(1)
  @Max(12)
  grade!: number;

  @IsOptional()
  @IsString()
  section?: string | null;

  @IsOptional()
  @IsString()
  academic_year?: string | null;

  @IsOptional()
  @IsString()
  source_type?: string;

  @IsOptional()
  items?: Array<{
    week_order?: number | null;
    unite?: string | null;
    code?: string | null;
    description: string;
    sort_order?: number;
  }>;
}
