import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { SchoolType } from '../../types/enums';

export class UpdateAcademicCalendarItemDto {
  @IsOptional()
  @IsUUID()
  week_id?: string;

  @IsOptional()
  @IsString()
  item_type?: 'belirli_gun_hafta' | 'ogretmen_isleri';

  @IsOptional()
  @IsString()
  @MaxLength(150)
  title?: string;

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

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(16)
  @IsEnum(SchoolType, { each: true })
  school_types?: SchoolType[] | null;
}
