import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @MinLength(1, { message: 'Mevcut şifre gerekli.' })
  current_password: string;

  @IsString()
  @MinLength(8, { message: 'Yeni şifre en az 8 karakter olmalıdır.' })
  @MaxLength(128, { message: 'Yeni şifre en fazla 128 karakter olabilir.' })
  @Matches(/^(?=.*\p{L})(?=.*\d).{8,128}$/u, {
    message: 'Şifre en az bir harf ve bir rakam içermelidir.',
  })
  new_password: string;
}
