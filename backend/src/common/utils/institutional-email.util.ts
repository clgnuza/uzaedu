/** Kurumsal adresteki @ sonrası alan adı (ör. info@a.meb.k12.tr → a.meb.k12.tr) */
export function emailDomainFromInstitutional(institutionalEmail: string | null | undefined): string | null {
  const t = (institutionalEmail ?? '').trim().toLowerCase();
  const at = t.lastIndexOf('@');
  if (at < 1 || at >= t.length - 1) return null;
  return t.slice(at + 1);
}

export function emailMatchesInstitutionalDomain(
  userEmail: string,
  institutionalEmail: string | null | undefined,
): boolean {
  const dom = emailDomainFromInstitutional(institutionalEmail);
  if (!dom) return false;
  const e = userEmail.trim().toLowerCase();
  if (!e.includes('@')) return false;
  return e.endsWith(`@${dom}`);
}

export function emailLocalPart(userEmail: string): string | null {
  const e = userEmail.trim().toLowerCase();
  const at = e.indexOf('@');
  if (at < 1) return null;
  return e.slice(0, at);
}

/** Kurumsal adresin @ öncesi kısmı kurum kodu ile başlamalı (ör. 123456@meb.k12.tr). */
export function emailStartsWithInstitutionCode(userEmail: string, institutionCode: string): boolean {
  const local = emailLocalPart(userEmail);
  const code = institutionCode.trim().toLowerCase();
  if (!local || !code) return false;
  return local === code || local.startsWith(code);
}

export function schoolInstitutionalEmailExample(
  institutionCode: string,
  institutionalEmail: string | null | undefined,
): string | null {
  const code = institutionCode.trim();
  const dom = emailDomainFromInstitutional(institutionalEmail);
  if (!code || !dom) return null;
  return `${code}@${dom}`;
}

export function emailMatchesSchoolInstitution(
  userEmail: string,
  institutionCode: string,
  institutionalEmail: string | null | undefined,
): boolean {
  if (!emailMatchesInstitutionalDomain(userEmail, institutionalEmail)) return false;
  return emailStartsWithInstitutionCode(userEmail, institutionCode);
}
