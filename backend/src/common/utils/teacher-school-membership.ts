import { UserRole, TeacherSchoolMembershipStatus } from '../../types/enums';

/** Kolon eklemeden önce school_id’li öğretmenler onaylı kabul edilir */
export function effectiveTeacherSchoolMembership(user: {
  role: string;
  school_id: string | null;
  teacherSchoolMembership: TeacherSchoolMembershipStatus;
}): TeacherSchoolMembershipStatus {
  if (
    user.role === UserRole.teacher &&
    user.teacherSchoolMembership === TeacherSchoolMembershipStatus.none &&
    user.school_id
  ) {
    return TeacherSchoolMembershipStatus.approved;
  }
  return user.teacherSchoolMembership;
}
