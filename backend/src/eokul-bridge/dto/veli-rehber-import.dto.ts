import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';

export class VeliRehberRowDto {
  @IsString()
  sinif_adi!: string;

  @IsString()
  ogrenci_no!: string;

  @IsString()
  ad_soyad!: string;

  @IsOptional()
  @IsString()
  anne_ad_soyad?: string;

  @IsOptional()
  @IsString()
  anne_telefon?: string;

  @IsOptional()
  @IsString()
  baba_ad_soyad?: string;

  @IsOptional()
  @IsString()
  baba_telefon?: string;
}

export class VeliRehberImportDto {
  @IsOptional()
  @IsUUID()
  school_id?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => VeliRehberRowDto)
  rows!: VeliRehberRowDto[];
}
