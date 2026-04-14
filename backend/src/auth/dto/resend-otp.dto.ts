import { IsEmail, IsIn } from 'class-validator';
import type { AuthOtpPurpose } from '../entities/auth-verification-code.entity';

const PURPOSES: AuthOtpPurpose[] = [
  'login_teacher',
  'login_school',
  'register_teacher',
  'register_school',
  'forgot_password',
  'school_join',
];

export class ResendOtpDto {
  @IsEmail({ require_tld: false })
  email: string;

  @IsIn(PURPOSES)
  purpose: AuthOtpPurpose;
}
