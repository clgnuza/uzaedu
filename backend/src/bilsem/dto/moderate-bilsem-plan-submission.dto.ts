import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class PublishBilsemPlanSubmissionDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(50)
  reward_jeton_per_generation?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  review_note?: string | null;
}

export class RejectBilsemPlanSubmissionDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  review_note?: string | null;
}

export class UnpublishBilsemPlanSubmissionDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string | null;
}
