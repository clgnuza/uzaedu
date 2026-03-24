import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBilsemCalendarItemDto {
  @IsUUID()
  week_id: string;

  @IsString()
  item_type: 'belirli_gun_hafta' | 'dep' | 'tanilama' | 'diger';

  @IsString()
  @MaxLength(150)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  path?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  icon_key?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sort_order?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  is_active?: boolean;
}
