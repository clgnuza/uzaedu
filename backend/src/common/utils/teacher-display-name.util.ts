/** Türkçe uyumlu ad karşılaştırması (okul öğretmen birleştirme). */
export function normalizeTeacherDisplayName(name: string | null | undefined): string {
  if (!name?.trim()) return '';
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('tr-TR');
}
