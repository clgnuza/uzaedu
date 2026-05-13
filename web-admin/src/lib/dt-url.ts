export function dtUrl(path: string, role: string | null | undefined, schoolId: string | null | undefined): string {
  if ((role === 'superadmin' || role === 'moderator') && schoolId) {
    const [base, qs] = path.split('?');
    const u = new URLSearchParams(qs ?? '');
    u.set('school_id', schoolId);
    return `${base}?${u.toString()}`;
  }
  return path;
}

