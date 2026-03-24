import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class VerifyIosPurchaseDto {
  /** App Store verifyReceipt — receipt-data (Base64) */
  @IsString()
  @MinLength(20)
  @MaxLength(1200000)
  receipt_data_base64: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  expected_product_id?: string | null;

  @IsOptional()
  @IsIn(['jeton', 'ekders', 'unknown'])
  currency_kind?: 'jeton' | 'ekders' | 'unknown';

  @IsOptional()
  @IsIn(['consumable', 'subscription', 'unknown'])
  product_kind?: 'consumable' | 'subscription' | 'unknown';

  @IsOptional()
  @IsIn(['user', 'school'])
  credit_account?: 'user' | 'school';
}
