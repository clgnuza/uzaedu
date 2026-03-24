import { Type } from 'class-transformer';
import { IsString, IsOptional, Min, Max, IsInt } from 'class-validator';

/** Multipart form body – grade string gelir, transform ile number'a çevrilir */
export class GenerateDraftFromExcelDto {
  @IsString()
  subject_code!: string;

  @IsString()
  subject_label!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  grade!: number;

  @IsString()
  academic_year!: string;

  @IsOptional()
  @IsString()
  section?: string;

  @IsOptional()
  @IsString()
  model?: string;
}
