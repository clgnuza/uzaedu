export type TimetableColor = { bg: string; border: string; text: string };

function hashHue(text: string, seed: number): number {
  let h = seed;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h % 360;
}

/** Ders adına göre (sınıf görünümü). */
export function subjectColor(subject: string): TimetableColor {
  const hue = hashHue(subject, 17);
  return {
    bg: `hsl(${hue} 55% 95%)`,
    border: `hsl(${hue} 48% 52%)`,
    text: `hsl(${hue} 32% 24%)`,
  };
}

/** Şube adına göre (öğretmen / derslik görünümü). */
export function classSectionColor(section: string): TimetableColor {
  const hue = hashHue(section, 53);
  return {
    bg: `hsl(${hue} 50% 94%)`,
    border: `hsl(${hue} 45% 48%)`,
    text: `hsl(${hue} 30% 22%)`,
  };
}

export function entryCellColor(
  entry: { subject: string; class_section: string },
  view: 'class' | 'teacher' | 'room' | 'all' | undefined,
): TimetableColor {
  if (view === 'teacher' || view === 'room') return classSectionColor(entry.class_section);
  return subjectColor(entry.subject);
}

/** Stüdyo kısa kod: 9/A-MAT */
export function entryShortCode(entry: {
  class_section: string;
  subject: string;
  room_name?: string | null;
}): string {
  const sub = entry.subject.replace(/\s+/g, '').slice(0, 4).toUpperCase() || '?';
  const sec = entry.class_section.replace(/\s+/g, '');
  return `${sec}-${sub}`;
}
