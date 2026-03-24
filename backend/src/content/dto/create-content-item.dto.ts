import { IsString, IsOptional, IsUrl, IsBoolean, IsUUID, MaxLength } from 'class-validator';

export class CreateContentItemDto {
  @IsUUID()
  source_id: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  content_type?: string;

  @IsString()
  @MaxLength(512)
  title: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsUrl()
  @MaxLength(1024)
  source_url: string;

  @IsOptional()
  published_at?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city_filter?: string;
}
