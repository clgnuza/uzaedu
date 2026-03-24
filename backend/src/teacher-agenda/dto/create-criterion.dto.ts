import { IsString, IsOptional, IsUUID, IsInt, Min, Max, IsIn } from 'class-validator';

export class CreateCriterionDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  maxScore?: number;

  /** numeric = puan (0..maxScore), sign = +/- (artı, eksi, nötr) */
  @IsOptional()
  @IsIn(['numeric', 'sign'])
  scoreType?: 'numeric' | 'sign';

  @IsOptional()
  @IsUUID()
  subjectId?: string | null;
}
