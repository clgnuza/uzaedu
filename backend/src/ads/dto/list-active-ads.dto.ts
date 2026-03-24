import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

const PLATFORMS = ['web', 'ios', 'android'] as const;
const WEB_SURFACES = ['desktop', 'mobile', 'all'] as const;

function toOptionalBool(v: unknown): boolean | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  if (v === true || v === 'true' || v === '1') return true;
  if (v === false || v === 'false' || v === '0') return false;
  return undefined;
}

export class ListActiveAdsDto {
  @IsString()
  @IsIn(PLATFORMS)
  platform: 'web' | 'ios' | 'android';

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  placement?: string;

  /**
   * Kişiselleştirilmiş/targeting envanteri için rıza (AdMob UMP, ATT, vb.).
   * false/omit → meta.non_personalized_ads_recommended true; API targeting kayıtlarını filtreler.
   */
  @IsOptional()
  @Transform(({ value }) => toOptionalBool(value))
  @IsBoolean()
  targeting_allowed?: boolean;

  /** Web: çerez bandı — targeting için cookie_consent=accepted (app-config şalteriyle) */
  @IsOptional()
  @IsString()
  @IsIn(['accepted', 'rejected'])
  cookie_consent?: 'accepted' | 'rejected';

  /**
   * Web: AdSense / yerel reklam — mobil tarayıcı vs masaüstü envanteri.
   * all veya boş: tüm yüzeyler; desktop|mobile: ilgili slotlar.
   */
  @IsOptional()
  @IsString()
  @IsIn(WEB_SURFACES)
  web_surface?: 'desktop' | 'mobile' | 'all';
}
