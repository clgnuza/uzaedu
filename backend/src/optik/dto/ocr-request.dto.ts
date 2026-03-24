import { IsString, IsIn, IsOptional } from 'class-validator';

export class OcrRequestDto {
  /** Base64 encoded image (data URL veya raw base64) */
  @IsString()
  image_base64: string;

  /** Dil ipucu – OCR için */
  @IsOptional()
  @IsIn(['tr', 'en'])
  language_hint?: 'tr' | 'en';

  /** KEY = anahtar sayfası, STUDENT = öğrenci cevabı */
  @IsOptional()
  @IsIn(['KEY', 'STUDENT'])
  kind?: 'KEY' | 'STUDENT';
}
