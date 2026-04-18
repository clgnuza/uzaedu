import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, Min, Max } from 'class-validator';

export class ReviewPlacementScoreRowDto {
  @IsInt()
  @Min(1990)
  @Max(2100)
  year!: number;

  /** Merkezî yerleştirme (LGS) tabanı — alan adı eski uyumluluk için with_exam */
  @IsOptional()
  @IsNumber()
  with_exam?: number | null;

  /** Yerel yerleştirme göstergesi — alan adı eski uyumluluk için without_exam */
  @IsOptional()
  @IsNumber()
  without_exam?: number | null;
}
