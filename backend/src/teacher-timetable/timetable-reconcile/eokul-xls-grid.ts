import * as XLSX from 'xlsx';
import type { XlsRawCellRecord } from './types';
import { extractEokulLessonPairs, normalizeWhitespace } from './normalize';

const SLOT_TIME_RE = /(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/;
const SLOT_NUM_RE = /(\d{1,2})\s*\.\s*DERS/i;
/** 09:20-10:002. DERS — bitişik saat + ders no */
const SLOT_CONCAT_RE = /(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})(\d{1,2})\s*\.\s*DERS/i;
const ELECTIVE_ROW_RE = /Varsa\s+Öğretmenin\s+Seçmeli/i;

/** e-Okul öğretmen XLS: B Pzt, F Sal, J Çar, N Per, S Cum (0-based). */
export const EOKUL_WEEKDAY_COLUMNS: ReadonlyArray<{
  col: number;
  day: string;
  dayNum: number;
}> = [
  { col: 1, day: 'PAZARTESI', dayNum: 1 },
  { col: 5, day: 'SALI', dayNum: 2 },
  { col: 9, day: 'CARSAMBA', dayNum: 3 },
  { col: 13, day: 'PERSEMBE', dayNum: 4 },
  { col: 18, day: 'CUMA', dayNum: 5 },
];

function colLetter(n: number): string {
  let s = '';
  let x = n + 1;
  while (x > 0) {
    const m = (x - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

function mergeKey(sheetName: string, row: number, col: number, merges: XLSX.Range[]): string | null {
  for (const m of merges) {
    if (row >= m.s.r && row <= m.e.r && col >= m.s.c && col <= m.e.c) {
      return `${sheetName}:${m.s.r},${m.s.c}-${m.e.r},${m.e.c}`;
    }
  }
  return null;
}

function readCellText(
  sheet: XLSX.WorkSheet,
  merges: XLSX.Range[],
  ri: number,
  ci: number,
): string {
  const addr = XLSX.utils.encode_cell({ r: ri, c: ci });
  let cell = sheet[addr] as XLSX.CellObject | undefined;
  if (!cell || ((cell.v === '' || cell.v == null) && !cell.w)) {
    for (const m of merges) {
      if (ri >= m.s.r && ri <= m.e.r && ci >= m.s.c && ci <= m.e.c) {
        const master = XLSX.utils.encode_cell({ r: m.s.r, c: m.s.c });
        cell = sheet[master] as XLSX.CellObject | undefined;
        break;
      }
    }
  }
  if (!cell) return '';
  if (cell.w != null && String(cell.w).trim()) return normalizeWhitespace(String(cell.w));
  if (cell.t === 'n' && typeof cell.v === 'number' && cell.v > 0 && cell.v < 1) return '';
  if (cell.v == null) return '';
  return normalizeWhitespace(String(cell.v));
}

/** Yeni öğretmen bloğu: kısa “Seçmeli Dersleri:” satırı (uzun liste aynı öğretmenin seçmeli satırı). */
export function isTeacherBlockBoundary(col0: string): boolean {
  if (!ELECTIVE_ROW_RE.test(col0)) return false;
  const tail = col0.replace(/Varsa\s+Öğretmenin\s+Seçmeli\s+Dersleri\s*:?\s*/i, '').trim();
  return tail.length < 25;
}

export function parseSlotFromTimeColumn(cell: string): { slot: number | null; time: string | null } {
  const norm = cell.replace(/\r/g, '\n');
  const concat = SLOT_CONCAT_RE.exec(norm.replace(/\n/g, ''));
  if (concat) {
    return {
      slot: parseInt(concat[3]!, 10),
      time: `${concat[1]}-${concat[2]}`,
    };
  }
  const flat = norm.replace(/\n/g, ' ');
  const timeM = SLOT_TIME_RE.exec(flat);
  const time = timeM ? `${timeM[1]}-${timeM[2]}` : null;
  const slotM = SLOT_NUM_RE.exec(flat);
  const slot = slotM ? parseInt(slotM[1]!, 10) : null;
  return { slot, time };
}

export function isLessonCellText(raw: string): boolean {
  if (!raw || raw.length < 3) return false;
  return raw.includes('<->') || /\d{1,2}\s*\.?\s*Sınıf\s*\//i.test(raw);
}

function pickInstitutionalSheet(wb: XLSX.WorkBook): string {
  const lower = wb.SheetNames.map((n) => ({ n, l: n.trim().toLowerCase() }));
  const skip = new Set(['kılavuz', 'kilavuz', 'guide']);
  const candidates = lower.filter((x) => !skip.has(x.l));
  if (candidates.length === 1) return candidates[0]!.n;
  const byRows = candidates
    .map((x) => {
      const sh = wb.Sheets[x.n];
      const ref = sh?.['!ref'];
      if (!ref) return { n: x.n, rows: 0 };
      const r = XLSX.utils.decode_range(ref);
      return { n: x.n, rows: r.e.r - r.s.r + 1 };
    })
    .sort((a, b) => b.rows - a.rows);
  return byRows[0]?.n ?? wb.SheetNames[0]!;
}

export function parseEokulInstitutionalXls(
  filePath: string,
  options?: { maxRecords?: number },
): {
  records: XlsRawCellRecord[];
  meta: {
    sheet: string;
    row_count: number;
    record_count: number;
    truncated: boolean;
    block_count: number;
  };
} {
  const maxRecords = options?.maxRecords ?? 8000;
  const wb = XLSX.readFile(filePath, { cellDates: false });
  const sheetName = pickInstitutionalSheet(wb);
  const sheet = wb.Sheets[sheetName];
  if (!sheet?.['!ref']) {
    return {
      records: [],
      meta: { sheet: sheetName, row_count: 0, record_count: 0, truncated: false, block_count: 0 },
    };
  }

  const merges = (sheet['!merges'] ?? []) as XLSX.Range[];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false }) as unknown[][];

  const records: XlsRawCellRecord[] = [];
  let truncated = false;
  let blockIndex = 0;
  let currentSlot: number | null = null;
  let currentTime: string | null = null;

  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri];
    if (!Array.isArray(row)) continue;

    const col0 = readCellText(sheet, merges, ri, 0) || normalizeWhitespace(String(row[0] ?? ''));

    if (isTeacherBlockBoundary(col0)) {
      blockIndex++;
      currentSlot = null;
      currentTime = null;
      continue;
    }

    if (ELECTIVE_ROW_RE.test(col0)) {
      const tail = col0.replace(/Varsa\s+Öğretmenin\s+Seçmeli\s+Dersleri\s*:?\s*/i, '').trim();
      if (tail.length >= 25 && ri + 1 < rows.length) {
        const nextRow = rows[ri + 1];
        const nextCol0 = readCellText(sheet, merges, ri + 1, 0) || normalizeWhitespace(String(nextRow?.[0] ?? ''));
        if (/\d{2}:\d{2}-\d{2}:\d{2}\s+\d+\.\s*DERS/i.test(nextCol0)) {
          blockIndex++;
          currentSlot = null;
          currentTime = null;
          continue;
        }
      }

      const pairs = extractEokulLessonPairs(col0);
      for (const p of pairs) {
        if (records.length >= maxRecords) {
          truncated = true;
          break;
        }
        records.push({
          sheet: sheetName,
          row: ri + 1,
          column: 'A',
          column_index: 0,
          day: null,
          slot: null,
          time: null,
          raw_text: `${p.subject} <-> AMP - ${p.class_section}`,
          merge_id: null,
          block_index: blockIndex,
        });
      }
      continue;
    }

    const parsed = parseSlotFromTimeColumn(col0);
    if (parsed.slot != null) {
      currentSlot = parsed.slot;
      currentTime = parsed.time;
    }

    if (currentSlot == null) continue;

    for (const dc of EOKUL_WEEKDAY_COLUMNS) {
      const raw = readCellText(sheet, merges, ri, dc.col);
      if (!isLessonCellText(raw)) continue;
      if (records.length >= maxRecords) {
        truncated = true;
        break;
      }
      records.push({
        sheet: sheetName,
        row: ri + 1,
        column: colLetter(dc.col),
        column_index: dc.col,
        day: dc.day,
        slot: currentSlot,
        time: currentTime,
        raw_text: raw,
        merge_id: mergeKey(sheetName, ri, dc.col, merges),
        block_index: blockIndex,
      });
    }
    if (truncated) break;
  }

  return {
    records,
    meta: {
      sheet: sheetName,
      row_count: rows.length,
      record_count: records.length,
      truncated,
      block_count: blockIndex + 1,
    },
  };
}
