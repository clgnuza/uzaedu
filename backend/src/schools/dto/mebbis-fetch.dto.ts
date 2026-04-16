import { IsIn, IsOptional, IsString } from 'class-validator';

export class MebbisIlceQueryDto {
  @IsIn(['1', '2', '3'])
  owner!: '1' | '2' | '3';

  @IsString()
  il_kodu!: string;
}

export class MebbisTypeQueryDto {
  @IsIn(['1', '2', '3'])
  owner!: '1' | '2' | '3';

  @IsString()
  il_kodu!: string;

  @IsString()
  ilce_label!: string;
}

export class MebbisFetchDto {
  @IsIn(['1', '2', '3'])
  owner!: '1' | '2' | '3';

  @IsString()
  il_kodu!: string;

  /** MEBBİS ilçe listesinde görünen tam metin (örn. Çankaya) */
  @IsString()
  ilce_label!: string;

  /** Kurum türü açılır listesinde kısmi eşleşme (opsiyonel) */
  @IsOptional()
  @IsString()
  kurum_turu_contains?: string;
}
