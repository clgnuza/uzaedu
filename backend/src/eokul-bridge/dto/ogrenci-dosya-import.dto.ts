import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class OgrenciDosyaRowDto {
  @IsOptional()
  @IsString()
  sinif?: string;

  @IsOptional()
  @IsString()
  ogrenci_no?: string;

  @IsOptional()
  @IsString()
  ad_soyad?: string;

  @IsObject()
  values!: Record<string, string>;
}

export class OgrenciDosyaImportDto {
  @IsOptional()
  @IsUUID()
  school_id?: string;

  @IsString()
  group_id!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OgrenciDosyaRowDto)
  rows!: OgrenciDosyaRowDto[];
}
