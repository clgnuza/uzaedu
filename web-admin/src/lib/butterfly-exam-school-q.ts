'use client';

/** superadmin/moderator API çağrıları için `?school_id=` (okul seçiliyse). */
export function butterflyExamApiQuery(role: string | null | undefined, schoolId: string | null | undefined): string {
  if ((role === 'superadmin' || role === 'moderator') && schoolId) {
    return `?school_id=${encodeURIComponent(schoolId)}`;
  }
  return '';
}
