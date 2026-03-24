import { IsOptional, IsString, MinLength } from 'class-validator';

export class DeleteAccountDto {
  /** Şifre ile giriş yapan kullanıcılar için zorunlu (sunucu doğrular). */
  @IsOptional()
  @IsString()
  @MinLength(1)
  current_password?: string;
}
