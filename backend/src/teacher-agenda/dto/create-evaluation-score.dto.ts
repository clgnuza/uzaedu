import { IsString, IsInt, Min, Max, IsOptional } from 'class-validator';

export class CreateEvaluationScoreDto {
  @IsString()
  criterionId: string;

  @IsString()
  studentId: string;

  /** numeric kriterde 0..maxScore; sign kriterde -1, 0, 1 */
  @IsInt()
  @Min(-1)
  @Max(10)
  score: number;

  @IsString()
  noteDate: string;

  @IsOptional()
  @IsString()
  note?: string | null;
}
