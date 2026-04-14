/** Superadmin/moderator için ?school_id=... query string oluşturur */
export function sorumlulukExamApiQuery(role: string | undefined, schoolId: string | null): string {
  if ((role === 'superadmin' || role === 'moderator') && schoolId) {
    return `?school_id=${schoolId}`;
  }
  return '';
}
