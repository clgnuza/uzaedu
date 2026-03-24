import { IsString, IsOptional, IsInt, IsBoolean, IsUUID, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSiteMapItemDto {
  @IsOptional()
  @IsUUID()
  parentId?: string | null;

  @IsString()
  @MaxLength(150)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  path?: string | null;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}
