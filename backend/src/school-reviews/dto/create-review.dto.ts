import { IsInt, IsOptional, IsString, IsObject, IsBoolean, Min, Max, MaxLength } from 'class-validator';

export class CreateReviewDto {
  /** Tek puan (kriter yoksa). Kriter varsa ortalamadan hesaplanır, opsiyonel. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  /** Kriter bazlı puanlar { slug: number }. Kriter varsa zorunlu. */
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
