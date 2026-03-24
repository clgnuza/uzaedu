import { IsEmail, IsOptional, IsString, IsUUID, IsEnum, MaxLength, IsArray } from 'class-validator';
import { UserRole, UserStatus } from '../../types/enums';

export class CreateUserDto {
  @IsEmail({ require_tld: false })
  @MaxLength(255)
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  display_name?: string;

  @IsEnum(UserRole)
  role: UserRole;

  @IsOptional()
  @IsUUID()
  school_id?: string | null;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  firebase_uid?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  teacher_branch?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  teacher_phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  teacher_title?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  avatar_url?: string | null;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  teacher_subject_ids?: string[] | null;

  /** Moderator için yetkili modüller (sadece role=moderator ise) */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  moderator_modules?: string[] | null;
}
