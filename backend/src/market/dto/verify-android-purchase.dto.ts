import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class VerifyAndroidPurchaseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  product_id: string;

  @IsString()
  @MinLength(10)
  @MaxLength(8000)
  purchase_token: string;

  /** Boşsa GOOGLE_PLAY_PACKAGE_NAME ortam değişkeni */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  package_name?: string | null;

  @IsOptional()
  @IsIn(['jeton', 'ekders', 'unknown'])
  currency_kind?: 'jeton' | 'ekders' | 'unknown';

  @IsOptional()
  @IsIn(['consumable', 'subscription', 'unknown'])
  product_kind?: 'consumable' | 'subscription' | 'unknown';

  /** Okul yöneticisi: bakiye okul cüzdanına yüklensin (school_admin + school_id gerekli) */
  @IsOptional()
  @IsIn(['user', 'school'])
  credit_account?: 'user' | 'school';
}
