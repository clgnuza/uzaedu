import type { Me } from '@/providers/auth-provider';

export function isDutySchoolAdmin(me: Me | null | undefined): boolean {
  return me?.role === 'school_admin';
}
