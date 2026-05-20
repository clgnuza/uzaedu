const TR_MAP: Record<string, string> = {
  ç: 'c',
  ğ: 'g',
  ı: 'i',
  ö: 'o',
  ş: 's',
  ü: 'u',
  Ç: 'c',
  Ğ: 'g',
  İ: 'i',
  I: 'i',
  Ö: 'o',
  Ş: 's',
  Ü: 'u',
};

export function foldTurkish(s: string): string {
  let out = '';
  for (const ch of s) out += TR_MAP[ch] ?? ch;
  return out;
}

export function normalizeWhitespace(s: string | null | undefined): string {
  return String(s ?? '').replace(/\s+/g, ' ').trim();
}

const DAY_TO_NUM: Record<string, number> = {
  PAZARTESI: 1,
  PAZARTESİ: 1,
  SALI: 2,
  SALİ: 2,
  CARSAMBA: 3,
  ÇARŞAMBA: 3,
  CARŞAMBA: 3,
  PERSEMBE: 4,
  PERŞEMBE: 4,
  CUMA: 5,
};

export function normalizeDayLabel(raw: string): { label: string; dayNum: number } | null {
  const t = normalizeWhitespace(raw).toLocaleUpperCase('tr-TR');
  if (!t) return null;
  const folded = foldTurkish(t).toUpperCase();
  for (const [k, n] of Object.entries(DAY_TO_NUM)) {
    const fk = foldTurkish(k).toUpperCase();
    if (t === k || folded === fk || t.includes(k) || folded.includes(fk)) {
      return { label: k, dayNum: n };
    }
  }
  return null;
}

const BRANCH_LETTER = '[A-ZÇĞİÖŞÜ]';
const SINIF_WORD = '(?:Sınıf|Sınıfı|SNF|SINIF)';

/** "12. Sınıf / A Şubesi" → "12-A", "AMP-10A" → "10-A" */
export function normalizeClassToken(raw: string): string | null {
  const s = normalizeWhitespace(raw);
  if (!s) return null;

  const amp = new RegExp(
    `AMP\\s*[-/]?\\s*(\\d{1,2})\\s*\\.?\\s*${SINIF_WORD}?\\s*/\\s*(${BRANCH_LETTER})\\s*(?:Şubesi|ŞUBE|SUBESI)?`,
    'iu',
  ).exec(s);
  if (amp) return formatClassSection(`${amp[1]}${amp[2].toLocaleUpperCase('tr-TR')}`);

  const slash = new RegExp(
    `(\\d{1,2})\\s*\\.?\\s*${SINIF_WORD}?\\s*/\\s*(${BRANCH_LETTER})\\s*(?:Şubesi|ŞUBE|SUBESI)?`,
    'iu',
  ).exec(s);
  if (slash) return formatClassSection(`${slash[1]}${slash[2].toLocaleUpperCase('tr-TR')}`);

  const short = new RegExp(`^(\\d{1,2})\\s*[-/]\\s*(${BRANCH_LETTER})$`, 'iu').exec(s.replace(/\s/g, ''));
  if (short) return formatClassSection(`${short[1]}${short[2].toLocaleUpperCase('tr-TR')}`);

  const compact = new RegExp(`^(\\d{1,2})(${BRANCH_LETTER})$`, 'iu').exec(s.replace(/\s/g, ''));
  if (compact) return formatClassSection(`${compact[1]}${compact[2].toLocaleUpperCase('tr-TR')}`);

  return null;
}

/** "12A" / "12-A" → gösterim "12-A" */
export function formatClassSection(token: string): string {
  const t = normalizeWhitespace(token);
  const m = /^(\d{1,2})\s*[-/]?\s*([A-ZÇĞİÖŞÜ])$/iu.exec(t.replace(/\s/g, ''));
  if (m) return `${m[1]}-${m[2]!.toLocaleUpperCase('tr-TR')}`;
  return t.slice(0, 32);
}

const EOKUL_CLASS_TAIL =
  '(?:\\d{1,2}\\s*\\.?\\s*(?:Sınıf|Sınıfı)?\\s*\\/\\s*[A-ZÇĞİÖŞÜ]\\s*(?:Şubesi|ŞUBE)?|\\d{1,2}\\s*[-/]\\s*[A-ZÇĞİÖŞÜ])';
const EOKUL_LESSON_RE = new RegExp(`(.+?)\\s*<->\\s*AMP\\s*-\\s*(${EOKUL_CLASS_TAIL})`, 'giu');

/** Ardışık "DERS <-> AMP - … Şubesi" ifadelerini ayıkla */
export function extractEokulLessonPairs(text: string): Array<{ subject: string; class_section: string }> {
  const norm = normalizeWhitespace(text.replace(/(?<!<-)>\s*AMP/gi, '<-> AMP'));
  const out: Array<{ subject: string; class_section: string }> = [];
  const seen = new Set<string>();
  EOKUL_LESSON_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = EOKUL_LESSON_RE.exec(norm)) !== null) {
    const subject = normalizeWhitespace(m[1] ?? '');
    const cls = normalizeClassToken(m[2] ?? '');
    if (!subject || subject.length < 2 || !cls) continue;
    const key = `${cls}\t${foldTurkish(subject).toUpperCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ subject: subject.slice(0, 128), class_section: cls });
  }
  return out;
}

/** e-Okul hücre: "DERS <-> AMP - 12. Sınıf / A" (virgülle çoklu ders) */
export function splitEokulCell(raw: string): Array<{ subject: string; class_section: string }> {
  const text = normalizeWhitespace(raw.replace(/\r/g, ' ').replace(/(?<!<-)>\s*AMP/gi, '<-> AMP')).trim();
  if (!text) return [];
  if (/^\d+(\.\d+)?$/.test(text)) return [];

  const paired = extractEokulLessonPairs(text);
  if (paired.length > 0) return paired;

  const segments = text
    .split(/,(?=\s*[^,]+(?:<->|→|->))/)
    .flatMap((seg) => seg.split(/\n+/))
    .map((p) => p.trim())
    .filter((p) => p.length > 2 && !/^şubesi$/iu.test(p));

  const out: Array<{ subject: string; class_section: string }> = [];
  const seen = new Set<string>();

  for (const part of segments.length ? segments : [text]) {
    const arrow = part.split(/<->|→|->/);
    let subject = normalizeWhitespace(arrow[0] ?? part);
    let classRaw = normalizeWhitespace(arrow.slice(1).join(' '));
    if (!classRaw && arrow.length === 1) {
      const m = /(.+?)\s+(?:AMP\s*[-/]?\s*.+|\d{1,2}\s*\.?\s*Sınıf.+)$/iu.exec(part);
      if (m) {
        subject = normalizeWhitespace(m[1]!);
        classRaw = normalizeWhitespace(m[2]!);
      }
    }
    const cls = normalizeClassToken(classRaw) || normalizeClassToken(part);
    if (!subject || subject.length < 2) continue;
    if (!cls) continue;
    const key = `${cls}\t${foldTurkish(subject).toUpperCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ subject: subject.slice(0, 128), class_section: cls });
  }
  return out;
}

export function normalizeTeacherName(raw: string): string {
  return normalizeWhitespace(raw)
    .replace(/\s{2,}/g, ' ')
    .toLocaleUpperCase('tr-TR');
}

/** PDF slot bloğu: çok satırlı AMP ve ardışık dersleri düzleştir */
export function normalizePdfSlotBlockText(block: string): string {
  return block
    .replace(/\r/g, '\n')
    .replace(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})\s*\n\s*\d{1,2}\s*\.\s*DERS/gi, ' ')
    .replace(/<->\s*AMP\s*\n\s*-\s*/gi, '<-> AMP - ')
    .replace(/<->\s*AMP\s*\n\s*-\s*/gi, '<-> AMP - ')
    .replace(/(?<!<-)>\s*AMP\s*\n\s*-\s*/gi, '<-> AMP - ');
}

/** PDF öğretmen sayfası — tek ders saati bloğundaki tüm dersleri çıkar (gün etiketi yok) */
export function extractLessonsFromPdfSlotBlock(block: string): Array<{ subject: string; class_section: string }> {
  const text = normalizePdfSlotBlockText(block);
  const paired = extractEokulLessonPairs(text);
  if (paired.length > 0) return paired;
  return splitEokulCell(text);
}

const DAY_NUMS = [1, 2, 3, 4, 5] as const;

/**
 * e-Okul PDF: slot bloğu içinde günler soldan sağa sırayla (Pzt…Cum), satır sonu ile ayrılır.
 */
export function splitPdfSlotBlockIntoDayChunks(block: string): string[] {
  const body = normalizePdfSlotBlockText(block)
    .replace(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})\s*\n?\s*\d{1,2}\s*\.\s*DERS/gi, ' ')
    .replace(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})(\d{1,2})\s*\.\s*DERS/gi, ' ')
    .trim();

  const lines = body
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 1 && !/^(PAZARTES|SALI|ÇARŞAMBA|PERŞEMBE|CUMA)/i.test(l));

  const chunks: string[] = [];
  let buf: string[] = [];

  const flush = () => {
    if (buf.length === 0) return;
    const text = buf.join('\n').trim();
    if (text.length > 3) chunks.push(text);
    buf = [];
  };

  for (const line of lines) {
    const startsNew =
      buf.length > 0 &&
      /(?:<->|>)\s*AMP/i.test(line) &&
      /(?:Şubesi\s*$|\d{1,2}\s*[-/]\s*[A-ZÇĞİÖŞÜ]\s*$)/i.test(buf[buf.length - 1] ?? '');

    if (startsNew) flush();
    buf.push(line);
    if (/(?:Şubesi|Sınıf\s*\/\s*[A-ZÇĞİÖŞÜ])\s*$/i.test(line) || /<->\s*AMP\s*-\s*\d{1,2}\s*[-/]\s*[A-ZÇĞİÖŞÜ]\s*$/i.test(line)) {
      flush();
    }
  }
  flush();

  if (chunks.length >= 2) return chunks.slice(0, 5);
  return chunks.length ? chunks : [body];
}

/** Slot bloğundan gün numaralı ders listesi (PDF-only öğretmenler). */
export function extractPdfSlotLessonsByDay(
  block: string,
): Array<{ day_num: number; subject: string; class_section: string }> {
  const chunks = splitPdfSlotBlockIntoDayChunks(block);
  const out: Array<{ day_num: number; subject: string; class_section: string }> = [];
  const seen = new Set<string>();

  chunks.forEach((chunk, idx) => {
    const dayNum = DAY_NUMS[Math.min(idx, 4)] ?? 5;
    for (const lesson of extractLessonsFromPdfSlotBlock(chunk)) {
      const key = `${dayNum}|${lesson.class_section}|${foldTurkish(lesson.subject).toUpperCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ day_num: dayNum, ...lesson });
    }
  });

  if (out.length === 0) {
    for (const lesson of extractLessonsFromPdfSlotBlock(block)) {
      out.push({ day_num: 1, ...lesson });
    }
  }
  return out;
}
