import { IsString, IsEmail, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail({ require_tld: false }, { message: 'Geçerli bir e-posta adresi girin.' })
  email: string;

  @IsString()
  @MinLength(1, { message: 'Şifre gerekli.' })
  password: string;
}
