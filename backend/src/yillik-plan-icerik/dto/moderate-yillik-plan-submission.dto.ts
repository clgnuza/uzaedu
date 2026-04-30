import { IsOptional, IsString, MaxLength } from 'class-validator';

export class PublishYillikPlanSubmissionDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  review_note?: string | null;
}

export class RejectYillikPlanSubmissionDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  review_note?: string | null;
}

export class UnpublishYillikPlanSubmissionDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string | null;
}
