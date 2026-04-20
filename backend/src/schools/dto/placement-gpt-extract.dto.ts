import { Type } from 'class-transformer';
import {
  IsArray,
  ArrayMaxSize,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class PlacementGptExtractDto {
  @IsString()
  @MaxLength(100_000)
  source_text!: string;

  /** Boş veya yok: kurum kodlu tüm okullar (limit ile sınırlı) */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(800)
  @IsUUID('4', { each: true })
  school_ids?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2000)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(4)
  @Max(30)
  batch_size?: number;

  /** both | central_only (merkezî/LGS) | local_only (yerel) — takma adlar backend’de normalize edilir */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  update_scope?: string;

  /**
   * Yapıştırılan tabloda hangi puan türleri var (GPT çıktısı normalize edilir).
   * central_only: yalnız LGS/merkezî — yerel alan temizlenir; tek sütun puan merkezîye taşınır.
   * local_only: yalnız yerel — merkezî temizlenir; tek sütun puan yerelde taşınır.
   */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  source_scores_in_table?: string;

  /** İl: `schools.city` ile eşleşir (trim, ILIKE). Doluysa bağlam ve DB uygulaması yalnız bu okullarla sınırlanır. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;
}
