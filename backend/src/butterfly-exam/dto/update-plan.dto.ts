import { IsDateString, IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateButterflyExamPlanDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsDateString()
  exam_starts_at?: string;

  @IsOptional()
  @IsDateString()
  exam_ends_at?: string | null;

  @IsOptional()
  @IsIn(['draft', 'published', 'archived'])
  status?: 'draft' | 'published' | 'archived';

  @IsOptional()
  @IsObject()
  rules?: Record<string, unknown>;
}
