import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class DevamsizlikOgrenciDto {
  @IsString()
  ogrenci_no!: string;

  @IsString()
  ad_soyad!: string;

  @IsOptional()
  @IsString()
  sinif_sube?: string;

  @IsOptional()
  @IsString()
  tc_kimlik?: string;

  @IsOptional()
  @IsBoolean()
  tam_gun?: boolean;

  @IsOptional()
  @IsBoolean()
  yarim_sabah?: boolean;

  @IsOptional()
  @IsBoolean()
  yarim_oglen?: boolean;

  @IsOptional()
  @IsBoolean()
  nobet?: boolean;

  @IsOptional()
  @IsBoolean()
  gec?: boolean;

  @IsOptional()
  @IsString()
  ders_yoklama?: string;
}

export class DevamsizlikSinifDto {
  @IsString()
  sinif_adi!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DevamsizlikOgrenciDto)
  ogrenciler!: DevamsizlikOgrenciDto[];
}

export class GunlukDevamsizlikImportDto {
  @IsOptional()
  @IsUUID()
  school_id?: string;

  @IsString()
  tarih_iso!: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  template?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DevamsizlikSinifDto)
  siniflar!: DevamsizlikSinifDto[];
}

export class DersDevamsizlikImportDto extends GunlukDevamsizlikImportDto {}
