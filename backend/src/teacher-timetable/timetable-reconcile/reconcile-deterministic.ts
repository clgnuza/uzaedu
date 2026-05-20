import type { PdfTeacherPageRecord, ReconciledFlatRow, XlsRawCellRecord } from './types';
import {
  foldTurkish,
  normalizeClassToken,
  normalizeTeacherName,
  normalizeWhitespace,
  splitEokulCell,
} from './normalize';


export type ReconcileDeterministicStats = {
  pdf_teachers: number;
  pdf_slots: number;
  xls_cells: number;
  xls_expanded: number;
  output_rows: number;
  xls_matched: number;
  needs_review: number;
  xls_blocks: number;
  excel_primary_teachers: number;
};

function normToken(s: string): string {
  return foldTurkish(normalizeWhitespace(s)).toUpperCase();
}

function dayLabelToNum(day: string): number | null {
  const d = normToken(day);
  if (d.includes('PAZARTES')) return 1;
  if (d.includes('SALI') && !d.includes('CARSAMBA')) return 2;
  if (d.includes('CARSAMBA') || d.includes('ÇARŞAMBA')) return 3;
  if (d.includes('PERSEMBE') || d.includes('PERŞEMBE')) return 4;
  if (d.includes('CUMA')) return 5;
  return null;
}

function emitFromExcelBlock(
  teacher: string,
  blockRecords: XlsRawCellRecord[],
  flat: ReconciledFlatRow[],
  seen: Set<string>,
): number {
  let n = 0;
  for (const r of blockRecords) {
    if (!r.day || r.slot == null) continue;
    const dayNum = dayLabelToNum(r.day);
    if (!dayNum) continue;
    const parts = splitEokulCell(r.raw_text);
    if (parts.length === 0) continue;
    for (const p of parts) {
      const key = `${teacher}|${dayNum}|${r.slot}|${p.class_section}|${normToken(p.subject)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      flat.push({
        teacher_name: teacher,
        day: dayNum,
        lesson_num: r.slot,
        class_section: p.class_section.slice(0, 32),
        subject: p.subject.slice(0, 128),
        confidence: 0.97,
        needs_review: false,
      });
      n++;
    }
  }
  return n;
}

/** Gün+saat+sınıf+ders anahtarı (PDF ↔ Excel blok eşlemesi). */
function lessonKeysFromPdfSlots(slots: PdfTeacherPageRecord['slots']): Set<string> {
  const keys = new Set<string>();
  for (const slot of slots) {
    if (!slot.day_num || slot.slot == null) continue;
    for (const p of splitEokulCell(slot.raw_text ?? '')) {
      keys.add(`${slot.day_num}|${slot.slot}|${p.class_section}|${normToken(p.subject)}`);
    }
  }
  return keys;
}

function lessonKeysFromBlock(blockRecords: XlsRawCellRecord[]): Set<string> {
  const keys = new Set<string>();
  for (const r of blockRecords) {
    if (!r.day || r.slot == null) continue;
    const dayNum = dayLabelToNum(r.day);
    if (!dayNum) continue;
    for (const p of splitEokulCell(r.raw_text)) {
      keys.add(`${dayNum}|${r.slot}|${p.class_section}|${normToken(p.subject)}`);
    }
  }
  return keys;
}

/** Sınıf+ders anahtarı (gün ignore, PDF parse hatalıysa fallback). */
function lessonKeysIgnoreDay(items: Array<{subject: string; class_section: string}>): Set<string> {
  const keys = new Set<string>();
  for (const p of items) {
    keys.add(`${p.class_section}|${normToken(p.subject)}`);
  }
  return keys;
}

function extractLessonsFromPdf(slots: PdfTeacherPageRecord['slots']): Array<{subject: string; class_section: string}> {
  const seen = new Set<string>();
  const out: Array<{subject: string; class_section: string}> = [];
  for (const slot of slots) {
    for (const p of splitEokulCell(slot.raw_text ?? '')) {
      const key = `${p.class_section}|${normToken(p.subject)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(p);
    }
  }
  return out;
}

function extractLessonsFromBlk(blockRecords: XlsRawCellRecord[]): Array<{subject: string; class_section: string}> {
  const seen = new Set<string>();
  const out: Array<{subject: string; class_section: string}> = [];
  for (const r of blockRecords) {
    for (const p of splitEokulCell(r.raw_text)) {
      const key = `${p.class_section}|${normToken(p.subject)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(p);
    }
  }
  return out;
}

function intersectKeyCount(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const k of a) {
    if (b.has(k)) n++;
  }
  return n;
}

/** PDF öğretmen ↔ Excel bloğu: en yüksek kesişim, blok başına tek atama. */
function assignPdfTeachersToXlsBlocks(
  pdfTeachers: PdfTeacherPageRecord[],
  blocksByIndex: Map<number, XlsRawCellRecord[]>,
  blockCount: number,
): Map<number, number> {
  const minIntersect = 1;
  const minIntersectNoDay = 1;
  const pairs: Array<{ ti: number; bi: number; score: number; method: string }> = [];

  for (let ti = 0; ti < pdfTeachers.length; ti++) {
    const t = pdfTeachers[ti]!;
    const pdfKeys = lessonKeysFromPdfSlots(t.slots);
    const pdfLessons = extractLessonsFromPdf(t.slots);
    const pdfKeysNoDay = lessonKeysIgnoreDay(pdfLessons);
    
    for (let bi = 0; bi < blockCount; bi++) {
      const blockRecords = blocksByIndex.get(bi) ?? [];
      const cellCount = blockRecords.filter((r) => r.day && r.slot != null).length;
      if (cellCount === 0) continue;

      const blkLessons = extractLessonsFromBlk(blockRecords);
      const blkKeysNoDay = lessonKeysIgnoreDay(blkLessons);
      const scoreNoDay = intersectKeyCount(pdfKeysNoDay, blkKeysNoDay);
      
      const score = intersectKeyCount(pdfKeys, lessonKeysFromBlock(blockRecords));
      
      if (scoreNoDay >= minIntersectNoDay) {
        const pdfTotalKeys = pdfKeysNoDay.size;
        const blkTotalKeys = blkKeysNoDay.size;
        const matchRatio = scoreNoDay / Math.max(pdfTotalKeys, 1);
        const reverseRatio = scoreNoDay / Math.max(blkTotalKeys, 1);
        const avgRatio = (matchRatio + reverseRatio) / 2;
        const adjustedScore = avgRatio >= 0.9 ? scoreNoDay * 5 : avgRatio >= 0.6 ? scoreNoDay * 3 : scoreNoDay * 1.8;
        pairs.push({ ti, bi, score: adjustedScore, method: 'no-day' });
        if (score >= minIntersect) {
          pairs.push({ ti, bi, score, method: 'day-aware' });
        }
      } else if (score >= minIntersect) {
        pairs.push({ ti, bi, score, method: 'day-aware' });
      }
    }
  }

  pairs.sort((a, b) => b.score - a.score);
  const teacherToBlock = new Map<number, number>();
  const usedBlocks = new Set<number>();
  for (const { ti, bi } of pairs) {
    if (teacherToBlock.has(ti) || usedBlocks.has(bi)) continue;
    teacherToBlock.set(ti, bi);
    usedBlocks.add(bi);
  }
  return teacherToBlock;
}

function emitFromPdfSlots(
  teacher: string,
  slots: PdfTeacherPageRecord['slots'],
  flat: ReconciledFlatRow[],
  seen: Set<string>,
): { rows: number; needsReview: number } {
  let rows = 0;
  let needsReview = 0;
  for (const slot of slots) {
    const lessonNum = slot.slot;
    if (!lessonNum || lessonNum < 1 || lessonNum > 12) continue;

    const parts = splitEokulCell(slot.raw_text);
    const items =
      parts.length > 0
        ? parts
        : slot.groups?.length
          ? slot.groups.map((g) => ({
              subject: (slot.course ?? '').trim() || 'Ders',
              class_section: normalizeClassToken(g) ?? g,
            }))
          : [];

    for (const item of items) {
      const dayNum = slot.day_num;
      if (!dayNum || dayNum < 1 || dayNum > 5) {
        needsReview++;
        continue;
      }
      const subject = item.subject.trim();
      const classSection = item.class_section.trim();
      if (!subject || !classSection) continue;

      const key = `${teacher}|${dayNum}|${lessonNum}|${classSection}|${normToken(subject)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      flat.push({
        teacher_name: teacher,
        day: dayNum,
        lesson_num: lessonNum,
        class_section: classSection.slice(0, 32),
        subject: subject.slice(0, 128),
        confidence: 0.88,
        needs_review: false,
      });
      rows++;
    }
  }
  return { rows, needsReview };
}

/**
 * Excel blokları PDF sırasıyla örtüşmeyebilir; içerik kesişimiyle eşleştirilir.
 * Eşleşmeyen öğretmenler → PDF (gün sıralı slot parse).
 */
export function reconcileDeterministic(
  pdfTeachers: PdfTeacherPageRecord[],
  xlsRecords: XlsRawCellRecord[],
): { flat: ReconciledFlatRow[]; stats: ReconcileDeterministicStats; warnings: string[] } {
  const flat: ReconciledFlatRow[] = [];
  const seen = new Set<string>();
  let pdfSlots = 0;
  let xlsMatched = 0;
  let needsReview = 0;
  let excelPrimary = 0;
  let xlsExpanded = 0;

  for (const r of xlsRecords) {
    if (r.day && r.slot != null) {
      xlsExpanded += splitEokulCell(r.raw_text).length;
    }
  }

  const blockCount = xlsRecords.length
    ? Math.max(...xlsRecords.map((r) => r.block_index)) + 1
    : 0;

  const blocksByIndex = new Map<number, XlsRawCellRecord[]>();
  for (const r of xlsRecords) {
    const list = blocksByIndex.get(r.block_index) ?? [];
    list.push(r);
    blocksByIndex.set(r.block_index, list);
  }

  const teacherToBlock = assignPdfTeachersToXlsBlocks(
    pdfTeachers,
    blocksByIndex,
    blockCount,
  );

  for (let ti = 0; ti < pdfTeachers.length; ti++) {
    const t = pdfTeachers[ti]!;
    const teacher = normalizeTeacherName(t.teacher ?? '');
    if (!teacher) continue;

    const bi = teacherToBlock.get(ti);
    if (bi != null) {
      const blockRecords = blocksByIndex.get(bi) ?? [];
      const cellCount = blockRecords.filter((r) => r.day && r.slot != null).length;
      if (cellCount > 0) {
        excelPrimary++;
        const n = emitFromExcelBlock(teacher, blockRecords, flat, seen);
        xlsMatched += n;
        pdfSlots += blockRecords.filter((r) => r.slot != null).length;
        continue;
      }
    }

    pdfSlots += t.slots.length;
    const { rows, needsReview: nr } = emitFromPdfSlots(teacher, t.slots, flat, seen);
    xlsMatched += rows;
    needsReview += nr;
  }

  const warnings: string[] = [];
  if (needsReview > 0) {
    warnings.push(`${needsReview} PDF satırında gün/sınıf çıkarılamadı.`);
  }
  if (flat.length === 0) {
    warnings.push('PDF ve Excel birleştirildikten sonra ders satırı çıkmadı.');
  }

  return {
    flat,
    stats: {
      pdf_teachers: pdfTeachers.length,
      pdf_slots: pdfSlots,
      xls_cells: xlsRecords.length,
      xls_expanded: xlsExpanded,
      output_rows: flat.length,
      xls_matched: xlsMatched,
      needs_review: needsReview,
      xls_blocks: blockCount,
      excel_primary_teachers: excelPrimary,
    },
    warnings,
  };
}
