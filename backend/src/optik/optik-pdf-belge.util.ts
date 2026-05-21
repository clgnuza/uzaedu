import { School } from '../schools/entities/school.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../types/enums';
import { formatEgitimOgretimYili } from '../sorumluluk-exam/sorumluluk-pdf-belge.util';

/** Eylül–Ağustos takvimine göre "2025-2026" */
export function inferAcademicYearFromDate(d = new Date()): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  if (m >= 9) return `${y}-${y + 1}`;
  return `${y - 1}-${y}`;
}

export function resolveOptikPdfBranding(
  school: Pick<School, 'name' | 'principalName'> | null,
  schoolAdmins: Array<Pick<User, 'evrakDefaults'>>,
): { schoolName: string; academicYear: string } {
  let ogretimYili = '';
  for (const a of schoolAdmins) {
    const y = a.evrakDefaults?.ogretim_yili?.trim();
    if (y) {
      ogretimYili = y;
      break;
    }
  }
  const rawYear = ogretimYili || inferAcademicYearFromDate();
  const academicYear = formatEgitimOgretimYili(rawYear) || formatEgitimOgretimYili(inferAcademicYearFromDate());
  return {
    schoolName: school?.name?.trim() || 'Okul',
    academicYear,
  };
}

export async function loadSchoolAdminsForOptikPdf(
  userRepo: { find: (opts: object) => Promise<User[]> },
  schoolId: string,
): Promise<User[]> {
  return userRepo.find({
    where: { school_id: schoolId, role: UserRole.school_admin },
    select: ['id', 'evrakDefaults'],
    order: { created_at: 'ASC' },
  });
}
