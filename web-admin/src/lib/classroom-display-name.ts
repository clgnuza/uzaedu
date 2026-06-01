export const CLASSROOM_DISPLAY_SUFFIX = ' · derslik';

export function formatClassroomDisplayName(section: string): string {
  const s = section.trim();
  if (!s) return 'Derslik';
  const low = s.toLocaleLowerCase('tr');
  if (low.endsWith('derslik') || s.includes(CLASSROOM_DISPLAY_SUFFIX)) return s;
  return `${s}${CLASSROOM_DISPLAY_SUFFIX}`;
}
