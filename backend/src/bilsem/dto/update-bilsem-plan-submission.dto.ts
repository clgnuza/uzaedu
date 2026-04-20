import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { BilsemPlanSubmissionWeekItemDto } from './create-bilsem-plan-submission.dto';

export class UpdateBilsemPlanSubmissionDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  subject_label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  ana_grup?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  alt_grup?: string | null;

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
  @Type(() => BilsemPlanSubmissionWeekItemDto)
  items?: BilsemPlanSubmissionWeekItemDto[];
}
