/** Bilsem katalog satırı: yetenek alanı veya Ek-1 bilsem_* kodu */
export function isBilsemCatalogSubject(s: { code: string; ana_grup?: string | null }): boolean {
  const ag = s.ana_grup;
  if (ag != null && String(ag).trim() !== '') return true;
  return s.code.toLowerCase().startsWith('bilsem_');
}

export function filterBilsemCatalogSubjects<T extends { code: string; ana_grup?: string | null }>(
  items: T[],
): T[] {
  return items.filter(isBilsemCatalogSubject);
}
