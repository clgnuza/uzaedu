import { IsArray, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class CustomItemDto {
  id!: string;
  weekId!: string;
  type!: 'belirli_gun_hafta' | 'ogretmen_isleri';
  title!: string;
  path?: string;
  sortOrder!: number;
}

export class PatchAcademicCalendarOverridesDto {
  @IsOptional()
  @IsArray()
  hiddenItemIds?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomItemDto)
  customItems?: CustomItemDto[];
}
