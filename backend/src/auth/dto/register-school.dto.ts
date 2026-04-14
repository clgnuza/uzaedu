import { IsBoolean, IsEmail, IsString, IsOptional, MinLength, MaxLength, Matches } from 'class-validator';

export class RegisterSchoolDto {
  @IsString()
  @MinLength(4)
  @MaxLength(16)
  @Matches(/^[0-9A-Za-z]+$/)
  institution_code: string;

  @IsEmail({ require_tld: false })
  @MaxLength(255)
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*\p{L})(?=.*\d).{8,128}$/u, {
    message: 'Şifre en az bir harf ve bir rakam içermelidir.',
  })
  password: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  display_name?: string;

  @IsBoolean()
  consent_terms: boolean;
}
