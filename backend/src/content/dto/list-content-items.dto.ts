import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class ListContentItemsDto {
  @IsOptional()
  @IsString()
  channel_key?: string;

  @IsOptional()
  @IsString()
  content_type?: string;

  @IsOptional()
  @IsString()
  source_key?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
