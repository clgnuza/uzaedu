import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';

export class VeliIzinOgrenciDto {
  @IsString()
  ad_soyad!: string;

  @IsString()
  ogrenci_no!: string;

  @IsString()
  sinif!: string;
}

export class VeliIzinSatirDto {
  @IsString()
  tarih!: string;

  @IsOptional()
  @IsString()
  tur?: string;
}

export class VeliIzinPdfDto {
  @IsOptional()
  @IsUUID()
  school_id?: string;

  @ValidateNested()
  @Type(() => VeliIzinOgrenciDto)
  ogrenci!: VeliIzinOgrenciDto;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => VeliIzinSatirDto)
  satirlar!: VeliIzinSatirDto[];
}
