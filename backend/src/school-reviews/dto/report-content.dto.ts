import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class ReportContentDto {
  @IsOptional()
  @IsString()
  @Matches(/^(spam|uygunsuz|yanlis_bilgi|diger)$/, { message: 'Geçersiz bildirim sebebi.' })
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Açıklama en fazla 500 karakter olabilir.' })
  comment?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-f0-9-]{20,64}$/i, { message: 'Geçersiz anonymous_id formatı.' })
  anonymous_id?: string;
}
