import type { SchoolSubject } from '@/hooks/use-school-classes-subjects';

/** Okul ders listesi — seçenek metni ve hücrede gösterim (kod varsa parantez içinde). */
export function formatSchoolSubjectOptionLabel(s: SchoolSubject): string {
  const name = (s.name || '').trim();
  const code = s.code?.trim();
  if (!code) return name || s.id;
  if (name.toLocaleLowerCase('tr') === code.toLocaleLowerCase('tr')) return name;
  return `${name} (${code})`;
}

/**
 * Kayıtlı `subject` alanını (id, ad, kod veya önceki tam etiket) okul kataloğunda eşleştirip
 * tutarlı gösterim metnine çevirir; eşleşme yoksa olduğu gibi döner.
 */
export function resolveSchoolSubjectDisplay(stored: string, subjects: SchoolSubject[]): string {
  const t = (stored || '').trim();
  if (!t) return stored;
  const byId = subjects.find((s) => s.id === t);
  if (byId) return formatSchoolSubjectOptionLabel(byId);
  for (const s of subjects) {
    const label = formatSchoolSubjectOptionLabel(s);
    if (t === label) return label;
    const name = (s.name || '').trim();
    if (name && t === name) return label;
    const code = s.code?.trim();
    if (code && t === code) return label;
  }
  return stored;
}
