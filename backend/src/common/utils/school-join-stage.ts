import { UserRole, TeacherSchoolMembershipStatus } from '../../types/enums';

export type SchoolJoinStage = 'none' | 'email_pending' | 'school_pending' | 'approved' | 'rejected';

export function schoolJoinStage(user: {
  role: string;
  school_id: string | null;
  teacherSchoolMembership: TeacherSchoolMembershipStatus;
  schoolJoinEmailVerifiedAt?: Date | null;
}): SchoolJoinStage {
  if (user.role !== UserRole.teacher) return 'none';
  const m = user.teacherSchoolMembership;
  if (m === TeacherSchoolMembershipStatus.rejected) return 'rejected';
  if (!user.school_id) return 'none';
  if (m === TeacherSchoolMembershipStatus.approved) return 'approved';
  if (m === TeacherSchoolMembershipStatus.pending) {
    if (!user.schoolJoinEmailVerifiedAt) return 'email_pending';
    return 'school_pending';
  }
  if (m === TeacherSchoolMembershipStatus.none) return 'approved';
  return 'none';
}
