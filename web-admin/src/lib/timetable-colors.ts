export type TimetableColor = { bg: string; border: string; text: string };

/** Birbirinden ayırt edilebilir sabit tonlar (rastgele hash kümelenmesini önler). */
const DISTINCT_HUES = [
  4, 18, 32, 48, 62, 78, 94, 110, 126, 142, 158, 174, 190, 206, 222, 238, 254, 270, 286, 302, 318, 334, 350,
];

function paletteHue(text: string, seed: number): number {
  const key = text.trim().toLocaleUpperCase('tr');
  let h = seed;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return DISTINCT_HUES[h % DISTINCT_HUES.length]!;
}

function colorsFromHue(hue: number, variant: 'subject' | 'section'): TimetableColor {
  if (variant === 'section') {
    return {
      bg: `hsl(${hue} 58% 91%)`,
      border: `hsl(${hue} 68% 40%)`,
      text: `hsl(${hue} 42% 18%)`,
    };
  }
  return {
    bg: `hsl(${hue} 72% 91%)`,
    border: `hsl(${hue} 78% 38%)`,
    text: `hsl(${hue} 48% 17%)`,
  };
}

/** Ders adına göre (sınıf görünümü). */
export function subjectColor(subject: string): TimetableColor {
  return colorsFromHue(paletteHue(subject, 17), 'subject');
}

/** Şube adına göre (öğretmen / derslik görünümü). */
export function classSectionColor(section: string): TimetableColor {
  return colorsFromHue(paletteHue(section, 53), 'section');
}

export function entryCellColor(
  entry: { subject: string; class_section: string },
  view: 'class' | 'teacher' | 'room' | 'all' | undefined,
): TimetableColor {
  if (view === 'teacher' || view === 'room') return classSectionColor(entry.class_section);
  return subjectColor(entry.subject);
}

export function entryCellInlineStyle(colors: TimetableColor): {
  backgroundColor: string;
  color: string;
  borderLeft: string;
} {
  return {
    backgroundColor: colors.bg,
    color: colors.text,
    borderLeft: `3px solid ${colors.border}`,
  };
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
