import { IsString, IsOptional, IsUrl, IsInt, IsBoolean, IsObject, MaxLength } from 'class-validator';

export class CreateContentSourceDto {
  @IsString()
  @MaxLength(64)
  key: string;

  @IsString()
  @MaxLength(128)
  label: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(512)
  base_url?: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(512)
  rss_url?: string;

  @IsOptional()
  @IsObject()
  scrape_config?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  sync_interval_minutes?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
