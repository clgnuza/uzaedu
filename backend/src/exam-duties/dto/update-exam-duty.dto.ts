import {
  IsString,
  IsOptional,
  IsIn,
  MaxLength,
  IsDateString,
  IsUrl,
} from 'class-validator';
import { EXAM_DUTY_CATEGORIES } from '../entities/exam-duty.entity';

export class UpdateExamDutyDto {
  @IsOptional()
  @IsString()
  @MaxLength(512)
  title?: string;

  @IsOptional()
  @IsString()
  @IsIn(EXAM_DUTY_CATEGORIES)
  category_slug?: string;

  @IsOptional()
  @IsString()
  summary?: string | null;

  @IsOptional()
  @IsString()
  body?: string | null;

  @IsOptional()
  @IsUrl()
  @MaxLength(1024)
  source_url?: string | null;

  @IsOptional()
  @IsUrl()
  @MaxLength(1024)
  application_url?: string | null;

  @IsOptional()
  @IsDateString()
  application_start?: string | null;

  @IsOptional()
  @IsDateString()
  application_end?: string | null;

  @IsOptional()
  @IsDateString()
  application_approval_end?: string | null;

  @IsOptional()
  @IsDateString()
  result_date?: string | null;

  @IsOptional()
  @IsDateString()
  exam_date?: string | null;

  @IsOptional()
  @IsDateString()
  exam_date_end?: string | null;
}
