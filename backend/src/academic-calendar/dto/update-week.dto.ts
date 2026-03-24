import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateAcademicCalendarWeekDto {
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
  @Type(() => Number)
  @IsInt()
  sort_order?: number;
}
