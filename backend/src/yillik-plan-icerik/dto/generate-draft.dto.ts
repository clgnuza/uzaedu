import { Type } from 'class-transformer';
import { IsString, IsInt, IsOptional, Min, Max } from 'class-validator';

export class GenerateDraftDto {
  @IsString()
  subject_code!: string;

  @IsString()
  subject_label!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  grade!: number;

  @IsOptional()
  @IsString()
  section?: string;

  @IsString()
  academic_year!: string;

  @IsOptional()
  @IsString()
  model?: string;
}
