import * as fs from 'fs';
import { PDFParse } from 'pdf-parse';
import type { PdfTeacherPageRecord, PdfTeacherSlotRecord } from './types';
import {
  extractPdfSlotLessonsByDay,
  extractLessonsFromPdfSlotBlock,
  normalizeWhitespace,
} from './normalize';

const TEACHER_RE = /Öğretmen\s+Adı\s+Soyadı\s*:\s*([^\n\t]+?)(?:\s{2,}|\t|\s*20\d{2}|\s*Branş)/i;
const BRANCH_RE = /Branş[ıi]\s*:\s*([^\n]+)/i;
const SLOT_BLOCK_RE =
  /(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})\s*(?:\n\s*)?(\d{1,2})\s*\.\s*DERS/gi;

function extractTeacherName(pageText: string): string | null {
  const m = TEACHER_RE.exec(pageText);
  if (!m?.[1]) return null;
  return normalizeWhitespace(m[1]).replace(/\s{2,}.*$/, '').trim() || null;
}

function extractBranch(pageText: string): string | null {
  const m = BRANCH_RE.exec(pageText);
  return m?.[1] ? normalizeWhitespace(m[1]).slice(0, 200) : null;
}

function parseSlotsFromPageText(pageText: string): PdfTeacherSlotRecord[] {
  const slots: PdfTeacherSlotRecord[] = [];
  const markers: Array<{ index: number; time: string; slot: number }> = [];
  let m: RegExpExecArray | null;
  SLOT_BLOCK_RE.lastIndex = 0;
  while ((m = SLOT_BLOCK_RE.exec(pageText)) !== null) {
    markers.push({
      index: m.index,
      time: `${m[1]}-${m[2]}`,
      slot: parseInt(m[3]!, 10),
    });
  }

  const DAY_LABELS = ['PAZARTESİ', 'SALI', 'ÇARŞAMBA', 'PERŞEMBE', 'CUMA'];

  for (let i = 0; i < markers.length; i++) {
    const start = markers[i]!.index;
    const end = i + 1 < markers.length ? markers[i + 1]!.index : pageText.length;
    let block = pageText.slice(start, end);
    const footer = block.search(/Varsa\s+Öğretmenin\s+Seçmeli/i);
    if (footer >= 0) block = block.slice(0, footer);

    const byDay = extractPdfSlotLessonsByDay(block);
    if (byDay.length > 0) {
      for (const lesson of byDay) {
        slots.push({
          day: DAY_LABELS[lesson.day_num - 1] ?? null,
          day_num: lesson.day_num,
          slot: markers[i]!.slot,
          time: markers[i]!.time,
          course: lesson.subject,
          groups: [lesson.class_section],
          raw_text: `${lesson.subject} <-> AMP - ${lesson.class_section}`,
        });
      }
      continue;
    }

    const lessons = extractLessonsFromPdfSlotBlock(block);
    for (const lesson of lessons) {
      slots.push({
        day: null,
        day_num: null,
        slot: markers[i]!.slot,
        time: markers[i]!.time,
        course: lesson.subject,
        groups: [lesson.class_section],
        raw_text: `${lesson.subject} <-> AMP - ${lesson.class_section}`,
      });
    }
  }

  return slots;
}

export async function parseEokulTeacherPdf(filePath: string): Promise<{
  teachers: PdfTeacherPageRecord[];
  meta: { page_count: number; teacher_count: number };
}> {
  const buf = fs.readFileSync(filePath);
  let parser: InstanceType<typeof PDFParse> | null = null;
  try {
    parser = new PDFParse({ data: buf });
    const parsed = await parser.getText();
    const pages = parsed?.pages ?? [];
    const teachers: PdfTeacherPageRecord[] = [];

    for (const p of pages) {
      const text = String(p?.text ?? '').trim();
      if (text.length < 60) continue;
      const teacher = extractTeacherName(text);
      if (!teacher) continue;
      const pageNum = typeof p?.num === 'number' ? p.num : teachers.length + 1;
      teachers.push({
        page: pageNum,
        teacher,
        branch: extractBranch(text),
        slots: parseSlotsFromPageText(text),
        raw_page_excerpt: text.length > 3500 ? `${text.slice(0, 3500)}\n[...]` : text,
      });
    }

    return {
      teachers,
      meta: { page_count: pages.length, teacher_count: teachers.length },
    };
  } finally {
    try {
      await (parser as { destroy?: () => Promise<void> } | null)?.destroy?.();
    } catch {
      /* ignore */
    }
  }
}
