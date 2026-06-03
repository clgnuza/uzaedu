import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';

export class IzinRowDto {
  @IsOptional()
  @IsString()
  ogrenci_no?: string;

  @IsString()
  ad_soyad!: string;

  @IsOptional()
  @IsString()
  sinif_adi?: string;

  @IsOptional()
  @IsString()
  izin_turu?: string;

  @IsOptional()
  @IsString()
  cikis?: string;

  @IsOptional()
  @IsString()
  donus?: string;
}

export class IzinImportDto {
  @IsOptional()
  @IsUUID()
  school_id?: string;

  @IsOptional()
  @IsString()
  tarih_iso?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  template?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => IzinRowDto)
  rows!: IzinRowDto[];
}
