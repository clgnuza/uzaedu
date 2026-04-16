import { IsEmail, IsUUID } from 'class-validator';

export class MergeTeacherRegistrationDto {
  @IsUUID()
  stub_user_id: string;

  @IsEmail({ require_tld: false })
  registered_email: string;
}
