import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class KelebekOgrenciDto {
  @IsString()
  ogrenci_no!: string;

  @IsString()
  ad!: string;

  @IsString()
  soyad!: string;

  @IsOptional()
  @IsString()
  cinsiyet?: string;
}

export class KelebekSinifDto {
  @IsString()
  sinif_adi!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KelebekOgrenciDto)
  ogrenciler!: KelebekOgrenciDto[];
}

export class KelebekImportDto {
  @IsOptional()
  @IsUUID()
  school_id?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => KelebekSinifDto)
  siniflar!: KelebekSinifDto[];

  @IsOptional()
  @IsIn(['ikili', 'tekli'])
  sira_tipi?: 'ikili' | 'tekli';

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(5)
  grup_sayisi?: number;

  @IsOptional()
  create_missing_classes?: boolean;
}
