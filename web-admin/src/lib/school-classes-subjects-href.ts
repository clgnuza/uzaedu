/** Okul yönetimi — Sınıflar ve Dersler (sekme). */
export function classesSubjectsHref(tab: 'classes' | 'subjects' | 'studentLists' = 'classes') {
  return `/classes-subjects?tab=${tab}`;
}
