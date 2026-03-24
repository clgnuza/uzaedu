import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

const PLATFORMS = ['web', 'ios', 'android'] as const;
const CONSENT_MODES = ['contextual', 'targeting'] as const;
const AD_PROVIDERS = ['adsense', 'admob', 'custom'] as const;
const WEB_SURFACES = ['desktop', 'mobile', 'all'] as const;

export class CreateAdDto {
  @IsString()
  @IsIn(PLATFORMS)
  platform: 'web' | 'ios' | 'android';

  @IsOptional()
  @IsString()
  @IsIn(AD_PROVIDERS)
  ad_provider?: 'adsense' | 'admob' | 'custom';

  /**
   * Yalnızca platform=web. AdSense / masaüstü-mobil ayrımı.
   */
  @IsOptional()
  @IsString()
  @IsIn(WEB_SURFACES)
  web_surface?: 'desktop' | 'mobile' | 'all';

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  placement: string;

  @IsString()
  @MinLength(1)
  @MaxLength(32)
  format: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title: string;

  @IsObject()
  payload: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @IsIn(CONSENT_MODES)
  consent_mode?: 'contextual' | 'targeting';

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priority?: number;

  @IsOptional()
  @Type(() => Date)
  starts_at?: Date | null;

  @IsOptional()
  @Type(() => Date)
  ends_at?: Date | null;
}
