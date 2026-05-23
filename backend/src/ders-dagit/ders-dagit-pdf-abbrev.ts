import type { PDFFont } from 'pdf-lib';
import { measurePdfTextBlock, truncateToWidth } from './ders-dagit-pdf-layout';

const SUBJECT_SHORT: Record<string, string> = {
  matematik: 'Mat.',
  'türkçe': 'Türk.',
  'türk dili ve edebiyatı': 'TDE',
  'türk dili': 'Türk.',
  fizik: 'Fiz.',
  kimya: 'Kim.',
  biyoloji: 'Biy.',
  tarih: 'Tar.',
  'coğrafya': 'Coğ.',
  'din kültürü ve ahlak bilgisi': 'Din Kl.',
  'din kültürü': 'Din Kl.',
  'beden eğitimi': 'Bed.E.',
  'beden eğitimi ve spor': 'Bed.E.',
  'müzik': 'Müz.',
  'görsel sanatlar': 'Gör.Sn.',
  'görsel sanatlar ve müzik': 'Gör./Müz.',
  ingilizce: 'İng.',
  almanca: 'Alm.',
  'fransızca': 'Fr.',
  'bilişim teknolojileri': 'Biliş.',
  'fen bilimleri': 'Fen',
  'sosyal bilgiler': 'Sos.B.',
};

function normalizeSubjectKey(raw: string): string {
  return raw
    .trim()
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/î/g, 'i')
    .replace(/â/g, 'a');
}

export function compactSubjectLabel(name: string): string {
  const raw = name.trim();
  if (!raw) return '';
  const key = normalizeSubjectKey(raw);
  const keyTr = raw.toLocaleLowerCase('tr');
  if (SUBJECT_SHORT[keyTr]) return SUBJECT_SHORT[keyTr];
  if (SUBJECT_SHORT[key]) return SUBJECT_SHORT[key];
  for (const [k, v] of Object.entries(SUBJECT_SHORT)) {
    const nk = normalizeSubjectKey(k);
    if (key.startsWith(nk) || nk.startsWith(key)) return v;
  }
  const words = raw.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const a = words[0]!.slice(0, 4);
    const b = words[1]!.slice(0, 3);
    return `${a} ${b}.`;
  }
  return raw.length > 9 ? `${raw.slice(0, 8)}.` : raw;
}

export function compactSectionLabel(section: string): string {
  const s = section.trim().replace(/\s+/g, '');
  if (!s) return '—';
  return s.length > 8 ? `${s.slice(0, 7)}…` : s;
}

/** Öğretmen adı: A. Soyad */
export function compactTeacherLabel(label: string | null | undefined): string {
  const raw = label?.trim();
  if (!raw) return '—';
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const ini = parts[0]!.slice(0, 1).toLocaleUpperCase('tr');
    const last = parts[parts.length - 1]!;
    return `${ini}. ${last}`;
  }
  return raw.length > 12 ? `${raw.slice(0, 11)}…` : raw;
}

/** Dar hücre — soyadı kısalt */
export function compactTeacherLabelCell(label: string | null | undefined): string {
  const raw = label?.trim();
  if (!raw) return '—';
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const ini = parts[0]!.slice(0, 1).toLocaleUpperCase('tr');
    const last = parts[parts.length - 1]!;
    const shortLast = last.length > 8 ? last.slice(0, 7) + '…' : last;
    return `${ini}. ${shortLast}`;
  }
  return raw.length > 9 ? `${raw.slice(0, 8)}…` : raw;
}

export function compactRoomLabel(name: string | null | undefined): string {
  const s = name?.trim();
  if (!s) return '—';
  return s.length > 10 ? `${s.slice(0, 9)}…` : s;
}

export type MasterSheetAxis = 'teacher' | 'class' | 'room';

/** Çarşaf liste hücresi — eksene göre kısaltılmış satır 1 / 2 */
export function masterCellAbbrevLines(
  axis: MasterSheetAxis,
  entry: { subject: string; class_section: string; teacher_label?: string | null; room_name?: string | null },
): { line1: string; line2: string } {
  const ders = compactSubjectLabel(entry.subject);
  if (axis === 'teacher') {
    return { line1: ders, line2: compactSectionLabel(entry.class_section) };
  }
  if (axis === 'class') {
    return { line1: ders, line2: compactTeacherLabelCell(entry.teacher_label) };
  }
  return { line1: ders, line2: compactSectionLabel(entry.class_section) };
}

export function masterRowDisplayLabel(axis: MasterSheetAxis, rowKey: string): string {
  if (axis === 'teacher') return compactTeacherLabel(rowKey);
  if (axis === 'class') return compactSectionLabel(rowKey);
  return compactRoomLabel(rowKey);
}

const LINE_GAP = 2;

export function fitTwoLineCell(
  line1: string,
  line2: string,
  font: PDFFont,
  maxW: number,
  maxH: number,
  /** buildMasterRows zaten kısaltmış gönderiyorsa true */
  preAbbreviated = true,
): { line1: string; line2: string; size: number; size2: number } {
  const subj = preAbbreviated ? line1.trim() : compactSubjectLabel(line1);
  const sec = line2.trim();
  const innerH = Math.max(10, maxH - 2);
  const narrow = maxW < 42;

  for (const size of [7, 6.5, 6, 5.5, 5, 4.5]) {
    const s2 = sec ? Math.max(4.5, size - 0.5) : size;
    const l1 = truncateToWidth(subj, font, size, maxW);
    const l2 = sec ? truncateToWidth(sec, font, s2, maxW) : '';
    const blockH = sec
      ? measurePdfTextBlock(
          [
            { text: l1, size, font },
            { text: l2, size: s2, font },
          ],
          LINE_GAP,
        )
      : measurePdfTextBlock([{ text: l1, size, font }], LINE_GAP);
    if (blockH <= innerH) return { line1: l1, line2: l2, size, size2: s2 };
  }

  if (sec) {
    const sep = narrow ? '·' : ' ';
    for (const size of [6, 5.5, 5, 4.5, 4]) {
      const one = truncateToWidth(`${subj}${sep}${sec}`, font, size, maxW);
      const blockH = measurePdfTextBlock([{ text: one, size, font }], LINE_GAP);
      if (blockH <= innerH) return { line1: one, line2: '', size, size2: size };
    }
    return {
      line1: truncateToWidth(`${subj}·${sec}`, font, 4, maxW),
      line2: '',
      size: 4,
      size2: 4,
    };
  }
  return {
    line1: truncateToWidth(subj, font, 4.5, maxW),
    line2: '',
    size: 4.5,
    size2: 4.5,
  };
}

/** Çarşaf hücresi için gereken minimum iç yükseklik (pt) */
export function estimateMasterCellMinHeight(
  line1: string,
  line2: string,
  font: PDFFont,
  maxW: number,
): number {
  const fit = fitTwoLineCell(line1, line2, font, maxW, 80, true);
  const lines = fit.line2
    ? [
        { text: fit.line1, size: fit.size, font },
        { text: fit.line2, size: fit.size2, font },
      ]
    : [{ text: fit.line1, size: fit.size, font }];
  return measurePdfTextBlock(lines, LINE_GAP) + 8;
}

export type SchedulePrintView = 'class' | 'teacher' | 'room';

/** Editör yazdırma / tek ızgara PDF — görünüme göre 3 satır */
export function scheduleCellLinesForView(
  entry: {
    subject: string;
    class_section: string;
    teacher_label?: string | null;
    room_name?: string | null;
  },
  view: SchedulePrintView,
): string[] {
  if (view === 'class') return scheduleCellAbbrevLines(entry);
  const out: string[] = [];
  const cls = compactSectionLabel(entry.class_section);
  const subj = compactSubjectLabel(entry.subject);
  if (view === 'teacher') {
    if (cls) out.push(cls);
    if (subj) out.push(subj);
    const room = entry.room_name?.trim();
    if (room) out.push(compactRoomLabel(room));
    return out;
  }
  if (cls) out.push(cls);
  if (subj) out.push(subj);
  const teacher = entry.teacher_label?.trim();
  if (teacher) out.push(compactTeacherLabelCell(teacher));
  return out;
}

/** Haftalık çizelge hücresi — ders, öğretmen, derslik (kısaltılmış) */
export function scheduleCellAbbrevLines(entry: {
  subject: string;
  teacher_label?: string | null;
  room_name?: string | null;
}): string[] {
  const out: string[] = [];
  const subj = compactSubjectLabel(entry.subject);
  if (subj) out.push(subj);
  const teacher = entry.teacher_label?.trim();
  if (teacher) out.push(compactTeacherLabelCell(teacher));
  const room = entry.room_name?.trim();
  if (room) out.push(compactRoomLabel(room));
  return out;
}

export function fitScheduleCellLines(
  rawLines: string[],
  font: PDFFont,
  maxW: number,
  maxH: number,
): Array<{ text: string; size: number }> {
  const lines = rawLines.map((l) => l.trim()).filter(Boolean).slice(0, 3);
  if (!lines.length) return [];

  const innerH = Math.max(10, maxH - 4);
  for (const base of [6.5, 6, 5.5, 5, 4.5]) {
    const sized = lines.map((t, i) => {
      const size = Math.max(4.5, base - i * 0.35);
      return { text: truncateToWidth(t, font, size, maxW), size, font };
    });
    const blockH = measurePdfTextBlock(sized, LINE_GAP);
    if (blockH <= innerH) return sized.map(({ text, size }) => ({ text, size }));
  }

  const narrow = maxW < 48;
  const combined = truncateToWidth(lines.join(narrow ? '·' : ' / '), font, 5, maxW);
  if (measurePdfTextBlock([{ text: combined, size: 5, font }], LINE_GAP) <= innerH) {
    return [{ text: combined, size: 5 }];
  }
  return [{ text: truncateToWidth(combined, font, 4.5, maxW), size: 4.5 }];
}

export function estimateScheduleCellMinHeight(lines: string[], font: PDFFont, maxW: number): number {
  const fit = fitScheduleCellLines(lines, font, maxW, 96);
  if (!fit.length) return 22;
  const block = fit.map((l) => ({ text: l.text, size: l.size, font }));
  return measurePdfTextBlock(block, LINE_GAP) + 10;
}
