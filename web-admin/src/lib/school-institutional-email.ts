/** Okul giriş/kayıt örnek adresi */
export const SCHOOL_LOGIN_EMAIL_PLACEHOLDER = '123456@meb.k12.tr';

export function emailLocalPart(email: string): string | null {
  const e = email.trim().toLowerCase();
  const at = e.indexOf('@');
  if (at < 1) return null;
  return e.slice(0, at);
}

export function emailStartsWithInstitutionCode(email: string, institutionCode: string): boolean {
  const local = emailLocalPart(email);
  const code = institutionCode.trim().toLowerCase();
  if (!local || !code) return false;
  return local === code || local.startsWith(code);
}

export function emailMatchesInstitutionalDomain(email: string, domain: string | null | undefined): boolean {
  const dom = (domain ?? '').trim().toLowerCase().replace(/^@/, '');
  if (!dom) return false;
  const e = email.trim().toLowerCase();
  return e.endsWith(`@${dom}`);
}

export function emailMatchesSchoolInstitution(
  email: string,
  institutionCode: string,
  requiredDomain: string | null | undefined,
): boolean {
  if (!emailMatchesInstitutionalDomain(email, requiredDomain)) return false;
  return emailStartsWithInstitutionCode(email, institutionCode);
}

export function schoolEmailExample(institutionCode: string, domain: string | null | undefined): string {
  const code = institutionCode.trim();
  const dom = (domain ?? 'meb.k12.tr').trim().replace(/^@/, '');
  return code ? `${code}@${dom}` : SCHOOL_LOGIN_EMAIL_PLACEHOLDER;
}
