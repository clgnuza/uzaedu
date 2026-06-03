import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';

export class MektupOgrenciDto {
  @IsString()
  ogrenci_no!: string;

  @IsString()
  ad_soyad!: string;

  @IsOptional()
  @IsString()
  sinif_adi?: string;

  @IsOptional()
  @IsString()
  toplam_devamsizlik?: string;
}

export class DevamsizlikMektupImportDto {
  @IsOptional()
  @IsUUID()
  school_id?: string;

  @IsString()
  uyari_dilimi!: string;

  @IsOptional()
  @IsString()
  uyari_dilimi_label?: string;

  @IsOptional()
  @IsBoolean()
  include_sent?: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MektupOgrenciDto)
  ogrenciler!: MektupOgrenciDto[];
}
