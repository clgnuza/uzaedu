/** Kazanım takip plan id: subject_code:grade:academic_year:section */
export function parseKazanimPlanId(id: string): {
  subject_code: string;
  grade: number;
  academic_year: string;
  section: string;
} | null {
  const parts = id.split(':');
  if (parts.length < 3) return null;
  const grade = Number(parts[1]);
  if (!Number.isFinite(grade)) return null;
  return {
    subject_code: parts[0]!,
    grade,
    academic_year: parts[2]!,
    section: parts.slice(3).join(':') || '',
  };
}
