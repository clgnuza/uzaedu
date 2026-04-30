import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { YillikPlanSubmissionWeekItemDto } from './create-yillik-plan-submission.dto';

export class UpdateYillikPlanSubmissionDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  subject_label?: string;

  @IsOptional()
  @Type(() => Number)
  grade?: number;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  section?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  academic_year?: string;

  @IsOptional()
  @IsString()
  tablo_alti_not?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500000)
  items_import?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => YillikPlanSubmissionWeekItemDto)
  items?: YillikPlanSubmissionWeekItemDto[];
}
