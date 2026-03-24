import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

const PLATFORMS = ['web', 'ios', 'android'] as const;
const AD_PROVIDERS = ['adsense', 'admob', 'custom'] as const;
const WEB_SURFACES = ['desktop', 'mobile', 'all'] as const;

export class ListAdsDto {
  @IsOptional()
  @IsString()
  @IsIn(PLATFORMS)
  platform?: 'web' | 'ios' | 'android';

  @IsOptional()
  @IsString()
  placement?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsString()
  @IsIn(AD_PROVIDERS)
  ad_provider?: 'adsense' | 'admob' | 'custom';

  @IsOptional()
  @IsString()
  @IsIn(WEB_SURFACES)
  web_surface?: 'desktop' | 'mobile' | 'all';

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
