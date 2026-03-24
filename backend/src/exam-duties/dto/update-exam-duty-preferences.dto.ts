import { IsArray, IsBoolean, IsIn, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { EXAM_DUTY_CATEGORIES } from '../entities/exam-duty.entity';

export class ExamDutyCategoryPreferenceDto {
  @IsString()
  @IsIn(EXAM_DUTY_CATEGORIES)
  slug: string;

  @IsOptional()
  @IsBoolean()
  pref_publish?: boolean;

  @IsOptional()
  @IsBoolean()
  pref_deadline?: boolean;

  @IsOptional()
  @IsBoolean()
  pref_approval_day?: boolean;

  @IsOptional()
  @IsBoolean()
  pref_exam_minus_1d?: boolean;

  @IsOptional()
  @IsBoolean()
  pref_exam_plus_1d?: boolean;

  @IsOptional()
  @IsBoolean()
  pref_exam_day_morning?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['07:00', '07:30', '08:00', '08:30', '09:00', '09:30'])
  pref_exam_day_morning_time?: string;
}

export class UpdateExamDutyPreferencesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExamDutyCategoryPreferenceDto)
  categories: ExamDutyCategoryPreferenceDto[];
}
