import { IsArray, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class CustomItemDto {
  id!: string;
  weekId!: string;
  type!: string;
  title!: string;
  path?: string;
  sortOrder!: number;
}

export class PatchBilsemCalendarOverridesDto {
  @IsOptional()
  @IsArray()
  hiddenItemIds?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomItemDto)
  customItems?: CustomItemDto[];
}
