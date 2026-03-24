import { IsIn } from 'class-validator';

export class TeacherSchoolMembershipActionDto {
  @IsIn(['approve', 'reject', 'revoke'])
  action: 'approve' | 'reject' | 'revoke';
}
