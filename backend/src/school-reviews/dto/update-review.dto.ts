import { IsOptional, IsInt, IsString, IsObject, IsBoolean, Min, Max, MaxLength } from 'class-validator';

export class UpdateReviewDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  rating?: number;

  @IsOptional()
  @IsObject()
  criteria_ratings?: Record<string, number>;

  @IsOptional()
  @IsBoolean()
  is_anonymous?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string | null;
}
