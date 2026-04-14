/**
 * iCalendar (.ics) üretimi — RFC 5545 uyumlu (CRLF, TEXT kaçışları, UTC zamanlar).
 * Birçok istemci (Google Takvim, Apple Takvim) LF-only veya yüzen saatlerde hata verebiliyor.
 */

export type DersProgramiIcsEntry = {
  day_of_week: number;
  lesson_num: number;
  class_section: string;
  subject: string;
};

const CRLF = '\r\n';

/** RFC 5545 TEXT değer kaçışı */
export function icsEscapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n/g, '\n')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

function toIcsUtc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

/** Satırı en fazla 75 oktet olacak şekilde katla (UTF-8) */
function foldIcsLine(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out: string[] = [];
  let rest = line;
  while (rest.length > 0) {
    let low = 1;
    let high = rest.length;
    let best = 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (enc.encode(rest.slice(0, mid)).length <= 75) {
        best = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    out.push(rest.slice(0, best));
    rest = rest.slice(best);
  }
  return out.map((p, i) => (i === 0 ? p : ` ${p}`)).join(CRLF);
}

/** Eğitim yılı Eylül’ü için “ilk tam Pazartesi sonrası” hafta ankoru (mevcut mantıkla uyumlu) */
function getFirstMondaySeptember(): Date {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const startYear = m >= 6 ? y + 1 : y;
  const septFirst = new Date(startYear, 8, 1);
  const d = new Date(septFirst);
  while (d.getDay() !== 1) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

/** 1=Pzt … 7=Paz — ankora göre o haftanın günü */
function dateForWeekday(anchorMonday: Date, dayOfWeek: number): Date {
  const t = new Date(anchorMonday);
  t.setDate(anchorMonday.getDate() + (dayOfWeek - 1));
  return t;
}

const DAY_COLOR: Record<number, string> = {
  1: '#0EA5E9',
  2: '#10B981',
  3: '#8B5CF6',
  4: '#F59E0B',
  5: '#F43F5E',
  6: '#06B6D4',
  7: '#6366F1',
};

export function buildDersProgramiIcs(
  entries: DersProgramiIcsEntry[],
  getTimeRangeForDay: (day: number, lesson: number) => string,
  options: { calName: string; academicYearLabel: string },
): string {
  const anchorMonday = getFirstMondaySeptember();
  const batchId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `b-${Date.now()}`;
  const out: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//OgretmenPro//DersProgrami//TR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEscapeText(options.calName)}`,
    `X-WR-CALDESC:${icsEscapeText(`${options.academicYearLabel} — Haftalık ders programı (Öğretmen Pro)`)}`,
  ];

  let idx = 0;
  const dtstamp = toIcsUtc(new Date());

  for (const e of entries) {
    if (!e.day_of_week || e.day_of_week < 1 || e.day_of_week > 7) continue;
    const range = getTimeRangeForDay(e.day_of_week, e.lesson_num);
    const [startStr, endStr] = range.split(' - ').map((s) => s?.trim() ?? '');
    if (!startStr || !endStr) continue;
    const [sh, sm] = startStr.split(':').map(Number);
    const [eh, em] = endStr.split(':').map(Number);
    const dayDate = dateForWeekday(anchorMonday, e.day_of_week);
    const eventDate = new Date(dayDate);
    eventDate.setHours(sh || 0, sm || 0, 0, 0);
    const endDate = new Date(dayDate);
    endDate.setHours(eh || 0, em || 0, 0, 0);
    if (endDate.getTime() <= eventDate.getTime()) {
      endDate.setTime(eventDate.getTime() + 40 * 60 * 1000);
    }

    const summary = icsEscapeText(`${e.class_section} — ${e.subject}`.trim() || 'Ders');
    const desc = icsEscapeText(
      `Sınıf: ${e.class_section}\\nDers: ${e.subject}\\nSaat: ${startStr}–${endStr}\\nKaynak: Öğretmen Pro`,
    );
    const uid = `${batchId}-d${e.day_of_week}-l${e.lesson_num}-${idx}@ogretmenpro.invalid`;
    idx += 1;

    const color = DAY_COLOR[e.day_of_week] ?? '#6366F1';

    out.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${toIcsUtc(eventDate)}`,
      `DTEND:${toIcsUtc(endDate)}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${desc}`,
      `RRULE:FREQ=WEEKLY;COUNT=36;WKST=MO`,
      'TRANSP:OPAQUE',
      'SEQUENCE:0',
      'STATUS:CONFIRMED',
      `COLOR:${color}`,
      'CATEGORIES:Ders programı',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'DESCRIPTION:Ders hatırlatması',
      'TRIGGER:-PT15M',
      'END:VALARM',
      'END:VEVENT',
    );
  }

  out.push('END:VCALENDAR');
  return out.map(foldIcsLine).join(CRLF);
}

export function downloadIcsFile(icsBody: string, filename: string): void {
  const blob = new Blob([icsBody], { type: 'text/calendar;charset=utf-8;method=PUBLISH' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.ics') ? filename : `${filename}.ics`;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function shareOrDownloadIcs(icsBody: string, filename: string): Promise<'share' | 'download'> {
  const blob = new Blob([icsBody], { type: 'text/calendar;charset=utf-8;method=PUBLISH' });
  const file = new File([blob], filename.endsWith('.ics') ? filename : `${filename}.ics`, {
    type: 'text/calendar;charset=utf-8',
  });

  if (typeof navigator !== 'undefined' && navigator.share && typeof navigator.canShare === 'function') {
    try {
      const payload = { files: [file], title: 'Ders programı', text: 'Takvim uygulamasına ekleyin' };
      if (navigator.canShare(payload)) {
        await navigator.share(payload);
        return 'share';
      }
    } catch {
      /* kullanıcı iptal veya destek yok */
    }
  }

  downloadIcsFile(icsBody, filename);
  return 'download';
}
