import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class ToplamDevamsizlikOgrenciDto {
  @IsString()
  ogrenci_no!: string;

  @IsString()
  ad_soyad!: string;

  @IsString()
  sinif_adi!: string;

  @IsOptional()
  @IsNumber()
  ozursuz_gun?: number;

  @IsOptional()
  @IsNumber()
  ozurlu_gun?: number;
}

export class ToplamDevamsizlikImportDto {
  @IsOptional()
  @IsUUID()
  school_id?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  template?: string;

  @IsOptional()
  @IsBoolean()
  use_ozursuz?: boolean;

  @IsOptional()
  @IsBoolean()
  use_ozurlu?: boolean;

  @IsOptional()
  @IsNumber()
  ozursuz_min?: number;

  @IsOptional()
  @IsNumber()
  ozursuz_max?: number;

  @IsOptional()
  @IsNumber()
  ozurlu_min?: number;

  @IsOptional()
  @IsNumber()
  ozurlu_max?: number;

  @IsOptional()
  @IsBoolean()
  combine_and?: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ToplamDevamsizlikOgrenciDto)
  ogrenciler!: ToplamDevamsizlikOgrenciDto[];
}
