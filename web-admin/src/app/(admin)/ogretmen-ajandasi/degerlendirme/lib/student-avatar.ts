/** Telifsiz: öğrenci id’sine göre sabit renk + isimden baş harfler. */

export const AVATAR_PALETTE: ReadonlyArray<{ bg: string; fg: string }> = [
  { bg: 'linear-gradient(135deg,#4f46e5,#6366f1)', fg: '#fff' },
  { bg: 'linear-gradient(135deg,#0d9488,#14b8a6)', fg: '#fff' },
  { bg: 'linear-gradient(135deg,#b45309,#d97706)', fg: '#fff' },
  { bg: 'linear-gradient(135deg,#be185d,#db2777)', fg: '#fff' },
  { bg: 'linear-gradient(135deg,#1d4ed8,#2563eb)', fg: '#fff' },
  { bg: 'linear-gradient(135deg,#047857,#059669)', fg: '#fff' },
  { bg: 'linear-gradient(135deg,#7c3aed,#8b5cf6)', fg: '#fff' },
  { bg: 'linear-gradient(135deg,#c2410c,#ea580c)', fg: '#fff' },
  { bg: 'linear-gradient(135deg,#0f766e,#0d9488)', fg: '#fff' },
  { bg: 'linear-gradient(135deg,#6d28d9,#7c3aed)', fg: '#fff' },
  { bg: 'linear-gradient(135deg,#a16207,#ca8a04)', fg: '#fff' },
  { bg: 'linear-gradient(135deg,#b91c1c,#dc2626)', fg: '#fff' },
  { bg: 'linear-gradient(135deg,#115e59,#0f766e)', fg: '#fff' },
  { bg: 'linear-gradient(135deg,#3730a3,#4f46e5)', fg: '#fff' },
  { bg: 'linear-gradient(135deg,#9d174d,#be185d)', fg: '#fff' },
  { bg: 'linear-gradient(135deg,#1e3a8a,#1d4ed8)', fg: '#fff' },
];

export function paletteIndexForId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h) % AVATAR_PALETTE.length;
}

export function studentInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0][0] ?? '';
    const b = parts[1][0] ?? '';
    return (a + b).toLocaleUpperCase('tr');
  }
  const one = parts[0] ?? '?';
  if (one.length >= 2) return one.slice(0, 2).toLocaleUpperCase('tr');
  return one.charAt(0).toLocaleUpperCase('tr');
}

/** Izgara kartı: üst satır ad(lar), alt satır soyad (son kelime, büyük harf). */
export function splitStudentNameForCard(full: string): { given: string; familyUpper: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { given: '?', familyUpper: '' };
  if (parts.length === 1) return { given: parts[0]!, familyUpper: '' };
  const family = parts[parts.length - 1] ?? '';
  const given = parts.slice(0, -1).join(' ');
  return { given, familyUpper: family.toLocaleUpperCase('tr') };
}
