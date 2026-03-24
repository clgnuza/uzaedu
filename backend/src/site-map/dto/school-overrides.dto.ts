import { IsOptional, IsArray, IsString, IsNumber, IsObject, ValidateNested, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

class CustomItemDto {
  @IsString()
  id: string;

  @IsOptional()
  @IsString()
  parentId?: string | null;

  @IsString()
  @MaxLength(150)
  title: string;

  @IsString()
  @MaxLength(255)
  path: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  sortOrder: number;
}

export class PatchSchoolOverridesDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hiddenIds?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomItemDto)
  customItems?: CustomItemDto[];
}
