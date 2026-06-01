/** Stüdyo: sağ panel işlemleri yalnızca seçili kayda ait */

export type DdEntityKind = 'ders' | 'ogretmen' | 'sinif' | 'derslik';

/** Atamalar tek tabloda; öğretmen/ders/derslik sayfalarındaki ders atama aynı kayıtları yazar. */
export const DD_SHARED_ASSIGNMENTS_HINT =
  'Ders atamaları stüdyoda ortaktır — bir sayfada eklenen atama diğer sayfalarda da görünür.';

/** Katalog (şube saatleri) ile atama kaydı ilişkisi. */
export const DD_CATALOG_ASSIGNMENTS_HINT =
  'Şube saatleri ders kataloğunda; atama kaydı öğretmen ve derslikle birlikte ortak tabloda. Katalog kaydı atamayı güncelleyebilir; atama kaydı şube saatini kataloğa yazar.';

export const ENTITY_KIND_LABEL: Record<DdEntityKind, string> = {
  ders: 'Ders',
  ogretmen: 'Öğretmen',
  sinif: 'Sınıf / şube',
  derslik: 'Derslik',
};

export function atamalarUrl(opts: {
  teacherId?: string;
  section?: string;
  roomId?: string;
  subjectId?: string;
}): string {
  const q = new URLSearchParams();
  if (opts.teacherId) q.set('teacher', opts.teacherId);
  if (opts.section) q.set('section', opts.section);
  if (opts.roomId) q.set('room', opts.roomId);
  if (opts.subjectId) q.set('subject', opts.subjectId);
  const s = q.toString();
  return `/ders-dagit/studyo/atamalar${s ? `?${s}` : ''}`;
}

export function kurallarUrl(opts: { profileId?: string; section?: string }): string {
  const q = new URLSearchParams();
  if (opts.profileId) q.set('profile', opts.profileId);
  if (opts.section) q.set('section', opts.section);
  const s = q.toString();
  return `/ders-dagit/studyo/kurallar${s ? `?${s}` : ''}`;
}

export function sinifSaatleriUrl(opts: { section?: string; openTime?: boolean }): string {
  const q = new URLSearchParams();
  if (opts.section) q.set('section', opts.section);
  if (opts.openTime) q.set('time', '1');
  const s = q.toString();
  return `/ders-dagit/studyo/sinif-saatleri${s ? `?${s}` : ''}`;
}

export function planlamaIliskileriUrl(opts: { profileId?: string; section?: string }): string {
  const q = new URLSearchParams();
  if (opts.profileId) q.set('profile', opts.profileId);
  if (opts.section) q.set('section', opts.section);
  const s = q.toString();
  return `/ders-dagit/studyo/planlama-iliskileri${s ? `?${s}` : ''}`;
}

export function profileIdForSection(
  profiles: Array<{ id: string; class_sections?: string[] }>,
  section: string,
): string | null {
  const hit = profiles.find((p) => (p.class_sections ?? []).includes(section));
  return hit?.id ?? null;
}
