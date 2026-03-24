import { IsString, IsInt, Min, Max } from 'class-validator';

export class ImportFromPlanDto {
  @IsString()
  subject_code!: string;

  @IsString()
  subject_label!: string;

  @IsInt()
  @Min(1)
  @Max(12)
  grade!: number;

  @IsString()
  academic_year!: string;
}
