import { IsEmail, IsString, Length, Matches, IsOptional, IsBoolean } from 'class-validator';

export class EmailCodeDto {
  @IsEmail({ require_tld: false })
  email: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  code: string;

  @IsOptional()
  @IsBoolean()
  remember_me?: boolean;
}
