import { IsString, IsOptional, IsObject, IsIn } from 'class-validator';

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
}
