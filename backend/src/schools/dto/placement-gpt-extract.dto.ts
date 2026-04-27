import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  ArrayMaxSize,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class PlacementGptExtractDto {
  /** Yapıştırılmış tablo / metin (boş bırakılabilir; o zaman `source_url` zorunlu). */
  @Transform(({ value }) => {
    if (value == null) return undefined;
    const s = String(value).replace(/\u00a0/g, ' ').trim();
    return s === '' ? undefined : s;
  })
  @IsOptional()
  @IsString()
  @MaxLength(150_000)
  source_text?: string;

  /**
   * kazanabilirsin.com LGS taban sayfası — sunucu HTML çeker, tabloyu ayrıştırır.
   * Doluysa `source_text` ile birlikte göndermeyin.
   */
  @Transform(({ value }) => {
    if (value == null) return undefined;
    const s = String(value).replace(/\u00a0/g, ' ').trim();
    return s === '' ? undefined : s;
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  source_url?: string;

  /** Boş veya yok: kurum kodlu tüm okullar (limit ile sınırlı) */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(800)
  @IsUUID('all', { each: true })
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
  @Max(50)
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

  /**
   * true: her okulda mevcut `review_placement_scores` yerine yalnız bu içe aktarılan satırlardan yeni demet (birleştirme yok).
   * false/undefined: mevcut iz+yıllarla birleştir (varsayılan CSV davranışı).
   */
  @IsOptional()
  @IsBoolean()
  replace_placement_scores?: boolean;
}
