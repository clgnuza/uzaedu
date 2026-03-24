import { IsString, IsOptional, IsBoolean, IsObject, MinLength, MaxLength } from 'class-validator';

export class CreateSyncSourceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  key: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  label: string;

  @IsString()
  @MaxLength(32)
  categorySlug: string;

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
