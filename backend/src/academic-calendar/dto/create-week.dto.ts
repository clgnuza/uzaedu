import { IsInt, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateAcademicCalendarWeekDto {
  @IsString()
  @MaxLength(16)
  academic_year: string;

  @IsInt()
  week_number: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string | null;

  @IsOptional()
  @IsString()
  date_start?: string | null;

  @IsOptional()
  @IsString()
  date_end?: string | null;

  @IsOptional()
  @IsInt()
  sort_order?: number;
}
