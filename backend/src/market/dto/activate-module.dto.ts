import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { MARKET_MODULE_KEYS } from '../../app-config/market-policy.defaults';

const KEYS = [...MARKET_MODULE_KEYS] as [string, ...string[]];

export class ActivateModuleDto {
  @IsString()
  @IsIn(KEYS)
  module_key!: string;

  /** Belirtilmezse: aylık tarife varsa ay, yoksa yıllık tarife yıl */
  @IsOptional()
  @IsIn(['month', 'year'])
  billing_period?: 'month' | 'year';

  /**
   * Yalnızca aylık etkinleştirmede: hangi UTC ayı (YYYY-MM). Boşsa bu ay.
   * Bu ay zaten etkinken gelecek aylar için tekrar aylık tarifeden satın alım.
   */
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, { message: 'target_month YYYY-MM formatında olmalıdır.' })
  target_month?: string;

  /**
   * Tarifede jeton ve ek ders ikisi de > 0 ise zorunlu: hangi bakiyeden düşüleceği.
   * Tek taraflı tarifede gönderilmez (sunucu tarafı otomatik).
   */
  @IsOptional()
  @IsIn(['jeton', 'ekders'])
  pay_with?: 'jeton' | 'ekders';

  /** Aynı onay isteğinin tekrarında çift düşümü önlemek için (isteğe bağlı UUID). */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  idempotency_key?: string;
}
