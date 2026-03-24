import { IsOptional, IsString, IsInt, Min, Max, MaxLength, IsBoolean } from 'class-validator';

export class UpdateCriteriaDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  hint?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  sort_order?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  min_score?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  max_score?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
