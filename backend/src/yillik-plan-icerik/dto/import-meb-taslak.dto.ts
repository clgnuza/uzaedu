import { IsInt, IsOptional, IsString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class ImportMebTaslakDto {
  @IsString()
  subject_code: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  grade: number;

  @IsString()
  academic_year: string;

  @IsOptional()
  @IsString()
  section?: string;

  @IsOptional()
  @IsString()
  model?: string;
}
