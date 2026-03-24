/** Aynı okuldaki öğretmenler arasında tam soyadı gizlemek için (örn. "Ayşe K.") */
export function maskTeacherDisplayName(name: string | null): string | null {
  if (!name?.trim()) return null;
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length === 1) {
    const w = parts[0];
    return w.length <= 2 ? `${w[0]}.` : `${w.slice(0, 2)}…`;
  }
  const last = parts[parts.length - 1];
  const first = parts.slice(0, -1).join(' ');
  const initial = last.charAt(0).toLocaleUpperCase('tr-TR');
  return `${first} ${initial}.`;
}
