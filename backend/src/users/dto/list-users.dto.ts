import { IsOptional, IsUUID, IsEnum, IsString, MaxLength } from 'class-validator';
import { UserRole, UserStatus, TeacherSchoolMembershipStatus } from '../../types/enums';
import { PaginationDto } from '../../common/dtos/pagination.dto';

export class ListUsersDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  school_id?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  sort?: string;

  @IsOptional()
  @IsEnum(TeacherSchoolMembershipStatus)
  teacher_school_membership?: TeacherSchoolMembershipStatus;
}
