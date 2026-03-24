import { IsEmail, IsString, MinLength, MaxLength, IsOptional, IsBoolean, Matches, IsUUID } from 'class-validator';

export class RegisterDto {
  @IsEmail({ require_tld: false })
  @MaxLength(255)
  email: string;

  @IsString()
  @MinLength(8, { message: 'Şifre en az 8 karakter olmalıdır.' })
  @MaxLength(128, { message: 'Şifre en fazla 128 karakter olabilir.' })
  @Matches(/^(?=.*\p{L})(?=.*\d).{8,128}$/u, {
    message: 'Şifre en az bir harf ve bir rakam içermelidir.',
  })
  password: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  display_name?: string;

  @IsOptional()
  @IsBoolean()
  consent_terms?: boolean;

  @IsOptional()
  @IsBoolean()
  consent_marketing?: boolean;

  @IsOptional()
  @IsUUID()
  school_id?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  @Matches(/^$|^[A-Za-z0-9]{4,32}$/, {
    message: 'Davet kodu 4–32 karakter, yalnızca harf ve rakam içerebilir.',
  })
  invite_code?: string;
}
