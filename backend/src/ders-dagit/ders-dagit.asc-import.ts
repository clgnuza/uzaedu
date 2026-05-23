/**
 * aSc Timetables XML — atama taslağı (e-Okul import ile aynı satır yapısı)
 * Dosya → Dışa aktar → aSc Timetables 2012 XML
 */
import { XMLParser } from 'fast-xml-parser';
import type { EokulAssignmentDraft, EokulImportPreview, EokulImportWarning } from './ders-dagit.eokul-import';
import { normalizeWhitespace } from './ders-dagit.elective';

function arr<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function attr(node: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = node[k] ?? node[`@_${k}`];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return '';
}

function childMap(
  root: Record<string, unknown>,
  containerKeys: string[],
  itemKeys: string[],
): Map<string, string> {
  const out = new Map<string, string>();
  let container: Record<string, unknown> | undefined;
  for (const ck of containerKeys) {
    const c = root[ck];
    if (c && typeof c === 'object') {
      container = c as Record<string, unknown>;
      break;
    }
  }
  if (!container) return out;
  let items: unknown[] = [];
  for (const ik of itemKeys) {
    const raw = container[ik];
    if (raw) {
      items = arr(raw as object);
      break;
    }
  }
  for (const it of items) {
    if (!it || typeof it !== 'object') continue;
    const o = it as Record<string, unknown>;
    const id = attr(o, 'id', 'ID');
    const name = attr(o, 'name', 'NAME', 'short', 'SHORT', 'caption', 'CAPTION') || attr(o, 'number', 'NUMBER');
    if (id && name) out.set(id, normalizeWhitespace(name));
  }
  return out;
}

function splitIds(raw: string): string[] {
  return raw
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseAscTimetablesXml(buffer: Buffer): EokulImportPreview {
  const warnings: EokulImportWarning[] = [];
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    trimValues: true,
    parseTagValue: false,
  });
  let doc: Record<string, unknown>;
  try {
    doc = parser.parse(buffer.toString('utf8')) as Record<string, unknown>;
  } catch {
    return {
      assignments: [],
      warnings: [{ code: 'ASC_XML_PARSE', message: 'XML okunamadı.' }],
      format: 'asc_xml',
      row_count: 0,
    };
  }
  const root =
    (doc.timetable as Record<string, unknown>) ??
    (doc.Timetable as Record<string, unknown>) ??
    (doc.timtable as Record<string, unknown>) ??
    doc;

  const classes = childMap(root, ['classes', 'Classes'], ['class', 'Class']);
  const teachers = childMap(root, ['teachers', 'Teachers'], ['teacher', 'Teacher']);
  const subjects = childMap(root, ['subjects', 'Subjects'], ['subject', 'Subject']);

  const lessonsBlock = root.lessons as Record<string, unknown> | undefined;
  const cardsBlock = root.cards as Record<string, unknown> | undefined;
  const lessonsRaw = [...arr(lessonsBlock?.lesson), ...arr(cardsBlock?.card)];

  const buckets = new Map<string, EokulAssignmentDraft & { _h: number }>();

  function add(
    subject: string,
    section: string,
    hours: number,
    teacherName: string | null,
  ) {
    const sub = normalizeWhitespace(subject).slice(0, 128);
    const sec = normalizeWhitespace(section).slice(0, 64);
    if (!sub || !sec) return;
    const k = `${sec}\0${sub}\0${teacherName ?? ''}`;
    const prev = buckets.get(k);
    if (prev) {
      prev._h += hours;
      prev.weekly_hours = prev._h;
    } else {
      buckets.set(k, {
        subject_name: sub,
        class_sections: [sec],
        weekly_hours: hours,
        teacher_tc: null,
        teacher_name: teacherName,
        _h: hours,
      });
    }
  }

  for (const les of lessonsRaw) {
    if (!les || typeof les !== 'object') continue;
    const o = les as Record<string, unknown>;
    const subjectIds = splitIds(attr(o, 'subjectid', 'subjectids', 'subjectId', 'subjectIds'));
    const classIds = splitIds(attr(o, 'classids', 'classIds', 'classid', 'classId'));
    const teacherIds = splitIds(attr(o, 'teacherids', 'teacherIds', 'teacherid', 'teacherId'));
    const periods = Number(attr(o, 'periodspercard', 'durationperiods', 'periods') || '1') || 1;
    const count = Number(attr(o, 'count', 'Count') || '1') || 1;
    const hours = Math.max(1, Math.min(40, periods * count));

    const subjectName =
      subjectIds.map((id) => subjects.get(id)).find(Boolean) ??
      attr(o, 'subjectname', 'subject') ??
      'Ders';
    const teacherName =
      teacherIds.map((id) => teachers.get(id)).find(Boolean) ?? (attr(o, 'teachername') || null);

    if (classIds.length) {
      for (const cid of classIds) {
        const sec = classes.get(cid) ?? cid;
        add(subjectName, sec, hours, teacherName);
      }
    } else {
      const sec = attr(o, 'classname', 'class') || 'Genel';
      add(subjectName, sec, hours, teacherName);
    }
  }

  if (!buckets.size) {
    warnings.push({
      code: 'ASC_NO_LESSONS',
      message:
        'XML içinde ders (lesson/card) bulunamadı. aSc: Dosya → Dışa aktar → aSc Timetables 2012 XML kullanın.',
    });
  }

  const assignments = [...buckets.values()].map(({ _h: _, ...r }) => ({
    ...r,
    weekly_hours: Math.max(1, r.weekly_hours),
  }));

  return {
    assignments,
    warnings,
    format: 'asc_xml',
    row_count: assignments.length,
  };
}
