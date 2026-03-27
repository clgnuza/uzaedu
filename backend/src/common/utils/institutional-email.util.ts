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
