import { IsEmail, MaxLength } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail({ require_tld: false })
  @MaxLength(255)
  email: string;
}
