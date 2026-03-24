import { IsOptional, IsString, IsBoolean, IsObject, MinLength, MaxLength } from 'class-validator';

export class UpdateSyncSourceDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  categorySlug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  rssUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  baseUrl?: string | null;

  @IsOptional()
  @IsObject()
  scrapeConfig?: Record<string, unknown> | null;

  @IsOptional()
  @IsString()
  titleKeywords?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  sortOrder?: number;
}
