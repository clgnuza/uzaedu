import { IsOptional, IsString, IsUUID, IsEnum, MaxLength, IsArray, IsBoolean } from 'class-validator';
import { UserRole, UserStatus, TeacherSchoolMembershipStatus } from '../../types/enums';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  display_name?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsUUID()
  school_id?: string | null;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  /** Sadece superadmin (öğretmen test / düzeltme) */
  @IsOptional()
  @IsEnum(TeacherSchoolMembershipStatus)
  teacher_school_membership?: TeacherSchoolMembershipStatus;

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

  /** Moderator için yetkili modüller */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  moderator_modules?: string[] | null;

  /** MEB Madde 91: Nöbetten muaf mı? (müdür, müdür yrd, hamile, engelli vb.) */
  @IsOptional()
  @IsBoolean()
  duty_exempt?: boolean;

  /** Nöbet muafiyet nedeni */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  duty_exempt_reason?: string | null;
}
