import { IsArray, IsBoolean, IsIn, IsOptional, IsString, ValidateIf, ValidateNested } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { EXAM_DUTY_CATEGORIES } from '../entities/exam-duty.entity';
import { IsMorningReminderTime } from './morning-reminder-time.validator';

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

  /** Boş/null = sistem varsayılanı (07:00); aksi 06:00–13:59 HH:mm */
  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @IsMorningReminderTime()
  pref_exam_day_morning_time?: string | null;
}

export class UpdateExamDutyPreferencesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExamDutyCategoryPreferenceDto)
  categories: ExamDutyCategoryPreferenceDto[];
}
