import { IsString, IsEmail, MinLength, IsOptional, IsBoolean } from 'class-validator';

export class LoginDto {
  @IsEmail({ require_tld: false }, { message: 'Geçerli bir e-posta adresi girin.' })
  email: string;

  @IsString()
  @MinLength(1, { message: 'Şifre gerekli.' })
  password: string;

  @IsOptional()
  @IsBoolean()
  remember_me?: boolean;
}
