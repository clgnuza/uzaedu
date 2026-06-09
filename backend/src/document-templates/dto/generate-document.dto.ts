import { IsString, IsOptional, IsObject, IsIn, IsBoolean } from 'class-validator';

export class GenerateDocumentDto {
  @IsString()
  template_id: string;

  /** Form verileri – formSchema'daki key'lerle eşleşir */
  @IsObject()
  @IsOptional()
  form_data?: Record<string, string | number>;

  /** Okul yöneticisi: okul cüzdanından düş (market politikası school sütunu) */
  @IsOptional()
  @IsIn(['user', 'school'])
  billing_account?: 'user' | 'school';

  /** Yıllık plan Word üretiminde hesap e-postasına ek gönder */
  @IsOptional()
  @IsBoolean()
  send_email?: boolean;
}
