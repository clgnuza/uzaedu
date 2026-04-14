import { IsEmail, IsString, MinLength, MaxLength, Length, Matches } from 'class-validator';

export class ResetPasswordCodeDto {
  @IsEmail({ require_tld: false })
  email: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  code: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*\p{L})(?=.*\d).{8,128}$/u, {
    message: 'Şifre en az bir harf ve bir rakam içermelidir.',
  })
  new_password: string;
}
