import { IsDateString, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateButterflyExamPlanDto {
  @IsString()
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDateString()
  exam_starts_at: string;

  @IsOptional()
  @IsDateString()
  exam_ends_at?: string;

  @IsOptional()
  @IsObject()
  rules?: Record<string, unknown>;
}
