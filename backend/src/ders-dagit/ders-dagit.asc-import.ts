/**
 * aSc Timetables 2012 XML — dersler, derslikler, gruplar, timeoff, atamalar
 */
import { XMLParser } from 'fast-xml-parser';
import type { EokulAssignmentDraft, EokulImportPreview, EokulImportWarning } from './ders-dagit.eokul-import';
import { normalizeWhitespace } from './ders-dagit.elective';
import { decodeXmlBufferToString } from './ders-dagit.xml-encoding';
import type { AscTeacherMeta } from './ders-dagit.teacher-name-match';

export type { AscTeacherMeta };

export type AscAssignmentDraft = EokulAssignmentDraft & {
  teacher_names?: string[];
  teacher_asc_ids?: string[];
  room_asc_ids?: string[];
  group_asc_id?: string | null;
  /** aSc periodspercard → kart dağılımı (örn. 2+2, tek 2'lik blok) */
  day_distribution?: number[];
  periods_per_card?: number;
};

export type AscTimeoffDraft = {
  entity: 'teacher' | 'class' | 'classroom' | 'subject';
  asc_id: string;
  day_of_week: number;
  lesson_num?: number;
  hard: boolean;
};

export type AscRoomDraft = {
  asc_id: string;
  name: string;
  short?: string;
  capacity?: number | null;
  building_asc_id?: string | null;
  building_name?: string | null;
};

export type AscGroupDraft = {
  asc_id: string;
  name: string;
  class_asc_id: string;
  entire_class?: boolean;
};

export type AscClassMeta = {
  asc_id: string;
  name: string;
  teacher_asc_id?: string | null;
  classroom_asc_ids: string[];
};

export type AscImportExtras = {
  buildings: Array<{ asc_id: string; name: string }>;
  rooms: AscRoomDraft[];
  classes: AscClassMeta[];
  groups: AscGroupDraft[];
  timeoffs: AscTimeoffDraft[];
  teacher_by_id: Record<string, string>;
  /** aSc teacher id → okul listesi eşleştirme adları */
  teacher_match_names: Record<string, string[]>;
  /** aSc teacher id → e-posta, partner_id (çoğu okulda TC), kısa ad */
  teacher_meta_by_id: Record<string, AscTeacherMeta>;
  class_by_id: Record<string, string>;
  subject_by_id: Record<string, string>;
  /** Şube → toplam haftalık ders saati (atamalardan) */
  section_weekly_hours: Record<string, number>;
  /** aSc `<periods>` tablosundaki en yüksek ders sırası */
  max_period_count: number;
};

export type AscImportPreview = EokulImportPreview & {
  assignments: AscAssignmentDraft[];
  asc: AscImportExtras;
};

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

function splitIds(raw: string): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function childItems(
  root: Record<string, unknown>,
  containerKeys: string[],
  itemKeys: string[],
): Record<string, unknown>[] {
  let container: Record<string, unknown> | undefined;
  for (const ck of containerKeys) {
    const c = root[ck];
    if (c && typeof c === 'object') container = c as Record<string, unknown>;
  }
  if (!container) return [];
  for (const ik of itemKeys) {
    const raw = container[ik];
    if (raw) return arr(raw as object).filter((x) => x && typeof x === 'object') as Record<string, unknown>[];
  }
  return [];
}

function buildTeacherMatchNames(o: Record<string, unknown>): string[] {
  const first = attr(o, 'firstname', 'firstName', 'FIRSTNAME');
  const last = attr(o, 'lastname', 'lastName', 'LASTNAME');
  const name = attr(o, 'name', 'NAME');
  const short = attr(o, 'short', 'SHORT');
  const out = new Set<string>();
  const add = (s: string) => {
    const t = normalizeWhitespace(s);
    if (t) out.add(t);
  };
  add(name);
  if (first && last) {
    add(`${first} ${last}`);
    add(`${last} ${first}`);
  }
  add(first);
  add(last);
  if (short.length >= 2) add(short);
  return [...out];
}

function childMap(
  root: Record<string, unknown>,
  containerKeys: string[],
  itemKeys: string[],
): Map<string, string> {
  const out = new Map<string, string>();
  for (const o of childItems(root, containerKeys, itemKeys)) {
    const id = attr(o, 'id', 'ID');
    const first = attr(o, 'firstname', 'firstName', 'FIRSTNAME');
    const last = attr(o, 'lastname', 'lastName', 'LASTNAME');
    const name =
      attr(o, 'name', 'NAME', 'short', 'SHORT', 'caption', 'CAPTION') ||
      (first && last ? `${first} ${last}` : first || last) ||
      attr(o, 'number', 'NUMBER');
    if (id && name) out.set(id, normalizeWhitespace(name));
  }
  return out;
}

/** Atamalardan şube haftalık saat toplamı */
export function buildAscSectionWeeklyHours(
  assignments: Array<{ class_sections: string[]; weekly_hours: number }>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const a of assignments) {
    const hrs = Math.max(0, Math.round(a.weekly_hours));
    for (const sec of a.class_sections ?? []) {
      const s = normalizeWhitespace(sec);
      if (!s || s === 'Genel') continue;
      out[s] = (out[s] ?? 0) + hrs;
    }
  }
  return out;
}

function parseAscMaxPeriodCount(root: Record<string, unknown>): number {
  let max = 0;
  for (const o of childItems(root, ['periods', 'Periods'], ['period', 'Period'])) {
    const n = Number(attr(o, 'period', 'Period', 'name', 'short') || '0');
    if (Number.isFinite(n) && n > max) max = n;
  }
  return Math.max(1, Math.min(14, max || 8));
}

function parseDaysBitmask(raw: string): number[] {
  const s = raw.trim();
  if (s.includes(',')) {
    const parts = s.split(',').map((x) => x.trim()).filter(Boolean);
    if (parts.every((p) => /^[01]+$/.test(p))) {
      const out = new Set<number>();
      for (const p of parts) {
        for (let i = 0; i < p.length; i++) {
          if (p[i] === '1') out.add(i + 1);
        }
      }
      return out.size ? [...out].sort((a, b) => a - b) : [1, 2, 3, 4, 5];
    }
    return parts
      .map((x) => Number(x.trim()))
      .filter((n) => n >= 1 && n <= 7);
  }
  if (/^[01]+$/.test(s)) {
    const out: number[] = [];
    for (let i = 0; i < s.length; i++) {
      if (s[i] === '1') out.push(i + 1);
    }
    return out.length ? out : [1, 2, 3, 4, 5];
  }
  const n = Number(s);
  if (n >= 1 && n <= 7) return [n];
  return [1, 2, 3, 4, 5];
}

function parseDaysDefs(root: Record<string, unknown>): Map<string, number[]> {
  const out = new Map<string, number[]>();
  for (const o of childItems(root, ['daysdefs', 'Daysdefs'], ['daysdef', 'Daysdef'])) {
    const id = attr(o, 'id', 'ID');
    const days = attr(o, 'days', 'Days');
    if (id && days) out.set(id, parseDaysBitmask(days));
  }
  return out;
}

function resolveDays(raw: string, defs: Map<string, number[]>): number[] {
  if (!raw) return [1, 2, 3, 4, 5];
  if (defs.has(raw)) return defs.get(raw)!;
  return parseDaysBitmask(raw);
}

function parseTimeoffs(root: Record<string, unknown>, daysDefs: Map<string, number[]>): AscTimeoffDraft[] {
  const out: AscTimeoffDraft[] = [];
  for (const o of childItems(root, ['timeoffs', 'Timeoffs'], ['timeoff', 'Timeoff'])) {
    const available = attr(o, 'available', 'timeoff', 'status', 'value').toLowerCase();
    if (available === '1' || available === 'true' || available === 'yes' || available === 'available') continue;
    const soft = available === '2' || available === 'question' || available === 'maybe';
    const hard = !soft;

    const periodRaw = attr(o, 'period', 'Period', 'lesson', 'slot');
    const lesson_num =
      !periodRaw || periodRaw === '0' ? undefined : Math.max(1, Math.min(14, Number(periodRaw) || 0)) || undefined;
    const dows = resolveDays(attr(o, 'days', 'Days', 'daysdefid', 'daysdef'), daysDefs);

    const push = (entity: AscTimeoffDraft['entity'], ids: string[]) => {
      for (const asc_id of ids) {
        for (const day_of_week of dows) {
          out.push({ entity, asc_id, day_of_week, lesson_num, hard });
        }
      }
    };

    push('teacher', splitIds(attr(o, 'teacherids', 'teacherIds', 'teacherid', 'teacherId')));
    push('class', splitIds(attr(o, 'classids', 'classIds', 'classid', 'classId')));
    push('classroom', splitIds(attr(o, 'classroomids', 'classroomIds', 'classroomid', 'roomids', 'roomIds')));
    push('subject', splitIds(attr(o, 'subjectids', 'subjectIds', 'subjectid', 'subjectId')));
  }
  return out;
}

type LessonRow = {
  subjectIds: string[];
  classIds: string[];
  teacherIds: string[];
  roomIds: string[];
  groupIds: string[];
  periodsPerWeek: number;
  periodsPerCard: number;
  count: number;
  subjectName?: string;
  teacherNames?: string[];
  className?: string;
};

function readLessonRow(o: Record<string, unknown>): LessonRow {
  return {
    subjectIds: splitIds(attr(o, 'subjectid', 'subjectids', 'subjectId', 'subjectIds')),
    classIds: splitIds(attr(o, 'classids', 'classIds', 'classid', 'classId')),
    teacherIds: splitIds(attr(o, 'teacherids', 'teacherIds', 'teacherid', 'teacherId')),
    roomIds: splitIds(attr(o, 'classroomids', 'classroomIds', 'classroomid', 'roomids', 'roomIds')),
    groupIds: splitIds(attr(o, 'groupids', 'groupIds', 'groupid', 'groupId')),
    periodsPerWeek: Number(attr(o, 'periodsperweek', 'periodsPerWeek') || '0'),
    periodsPerCard: Number(attr(o, 'periodspercard', 'durationperiods', 'periods') || '1') || 1,
    count: Number(attr(o, 'count', 'Count') || '1') || 1,
    subjectName: attr(o, 'subjectname', 'subject') || undefined,
    teacherNames: splitIds(attr(o, 'teachername', 'teacherName', 'TEACHERNAME')),
    className: attr(o, 'classname', 'class') || undefined,
  };
}

function lessonHours(row: LessonRow): number {
  return Math.max(
    1,
    Math.min(
      40,
      row.periodsPerWeek > 0 ? Math.round(row.periodsPerWeek) : row.periodsPerCard * row.count,
    ),
  );
}

/** aSc periodspercard + haftalık toplam → kart boyutları ([2] veya [2,2] …). */
export function buildAscCardDistribution(totalHours: number, periodsPerCard: number): number[] {
  const total = Math.max(1, Math.min(40, Math.round(totalHours)));
  const block = Math.max(1, Math.min(8, Math.round(periodsPerCard) || 1));
  if (block === 1) return Array(total).fill(1);
  if (total % block === 0) return Array(total / block).fill(block);
  const out: number[] = [];
  let rem = total;
  while (rem > 0) {
    const chunk = Math.min(block, rem);
    out.push(chunk);
    rem -= chunk;
  }
  return out;
}

export function parseAscTimetablesXml(buffer: Buffer): AscImportPreview {
  const warnings: EokulImportWarning[] = [];
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    trimValues: true,
    parseTagValue: false,
  });
  let doc: Record<string, unknown>;
  try {
    doc = parser.parse(decodeXmlBufferToString(buffer)) as Record<string, unknown>;
  } catch {
    return {
      assignments: [],
      warnings: [{ code: 'ASC_XML_PARSE', message: 'XML okunamadı.' }],
      format: 'asc_xml',
      row_count: 0,
      asc: { buildings: [], rooms: [], classes: [], groups: [], timeoffs: [], teacher_by_id: {}, teacher_match_names: {}, teacher_meta_by_id: {}, class_by_id: {}, subject_by_id: {}, section_weekly_hours: {}, max_period_count: 8 },
    };
  }
  const root =
    (doc.timetable as Record<string, unknown>) ??
    (doc.Timetable as Record<string, unknown>) ??
    (doc.timtable as Record<string, unknown>) ??
    doc;

  const daysDefs = parseDaysDefs(root);
  const classes = childMap(root, ['classes', 'Classes'], ['class', 'Class']);
  const teachers = childMap(root, ['teachers', 'Teachers'], ['teacher', 'Teacher']);
  const teacherMatchNames: Record<string, string[]> = {};
  const teacherMetaById: Record<string, AscTeacherMeta> = {};
  for (const o of childItems(root, ['teachers', 'Teachers'], ['teacher', 'Teacher'])) {
    const id = attr(o, 'id', 'ID');
    if (!id) continue;
    teacherMetaById[id] = {
      email: attr(o, 'email', 'EMAIL') || undefined,
      mobile: attr(o, 'mobile', 'MOBILE') || undefined,
      partner_id: attr(o, 'partner_id', 'partnerId', 'PARTNER_ID') || undefined,
      short: attr(o, 'short', 'SHORT') || undefined,
    };
    const variants = buildTeacherMatchNames(o);
    if (variants.length) teacherMatchNames[id] = variants;
  }
  const subjects = childMap(root, ['subjects', 'Subjects'], ['subject', 'Subject']);
  const buildings = childMap(root, ['buildings', 'Buildings'], ['building', 'Building']);
  const classrooms = childMap(root, ['classrooms', 'Classrooms'], ['classroom', 'Classroom']);

  const ascClasses: AscClassMeta[] = childItems(root, ['classes', 'Classes'], ['class', 'Class']).map((o) => ({
    asc_id: attr(o, 'id', 'ID'),
    name: normalizeWhitespace(
      attr(o, 'name', 'NAME', 'short', 'SHORT') || attr(o, 'id', 'ID'),
    ),
    teacher_asc_id: attr(o, 'teacherid', 'teacherId', 'TEACHERID') || null,
    classroom_asc_ids: splitIds(attr(o, 'classroomids', 'classroomIds', 'classroomid')),
  })).filter((c) => c.asc_id && c.name);

  const ascRooms: AscRoomDraft[] = childItems(root, ['classrooms', 'Classrooms'], ['classroom', 'Classroom']).map(
    (o) => {
      const buildingAscId = attr(o, 'buildingid', 'buildingId', 'BUILDINGID') || null;
      return {
        asc_id: attr(o, 'id', 'ID'),
        name: normalizeWhitespace(attr(o, 'name', 'NAME', 'short', 'SHORT') || attr(o, 'id', 'ID')),
        short: attr(o, 'short', 'SHORT') || undefined,
        capacity: Number(attr(o, 'capacity', 'CAPACITY') || '') || null,
        building_asc_id: buildingAscId,
        building_name: buildingAscId ? buildings.get(buildingAscId) ?? null : null,
      };
    },
  ).filter((r) => r.asc_id && r.name);

  const ascBuildings = childItems(root, ['buildings', 'Buildings'], ['building', 'Building']).map((o) => ({
    asc_id: attr(o, 'id', 'ID'),
    name: normalizeWhitespace(attr(o, 'name', 'NAME') || attr(o, 'id', 'ID')),
  })).filter((b) => b.asc_id && b.name);

  const ascGroups: AscGroupDraft[] = childItems(root, ['groups', 'Groups'], ['group', 'Group']).map((o) => ({
    asc_id: attr(o, 'id', 'ID'),
    name: normalizeWhitespace(attr(o, 'name', 'NAME', 'divisiontag', 'short') || attr(o, 'id', 'ID')),
    class_asc_id: attr(o, 'classid', 'classId', 'CLASSID'),
    entire_class: attr(o, 'entireclass', 'entireClass') === '1',
  })).filter((g) => g.asc_id && g.name && g.class_asc_id);

  const timeoffs = parseTimeoffs(root, daysDefs);

  const lessonSources = [
    ...childItems(root, ['lessons', 'Lessons'], ['lesson', 'Lesson']),
    ...childItems(root, ['groupsubjects', 'Groupsubjects'], ['groupsubject', 'Groupsubject']),
    ...childItems(root, ['classsubjects', 'Classsubjects'], ['classsubject', 'Classsubject']),
  ];

  const buckets = new Map<string, AscAssignmentDraft & { _h: number; _dist: number[] }>();

  function add(
    subject: string,
    section: string,
    hours: number,
    periodsPerCard: number,
    teacherNames: string[],
    teacherAscIds: string[],
    roomAscIds: string[],
    groupAscId?: string | null,
  ) {
    const sub = normalizeWhitespace(subject).slice(0, 128);
    const sec = normalizeWhitespace(section).slice(0, 64);
    if (!sub || !sec) return;
    const cardDist = buildAscCardDistribution(hours, periodsPerCard);
    const tKey = [...teacherNames].sort().join('|');
    const rKey = [...roomAscIds].sort().join('|');
    const k = `${sec}\0${sub}\0${tKey}\0${rKey}\0${groupAscId ?? ''}`;
    const prev = buckets.get(k);
    if (prev) {
      prev._h += hours;
      prev.weekly_hours = prev._h;
      prev._dist = [...prev._dist, ...cardDist];
      prev.day_distribution = prev._dist;
      prev.periods_per_card = Math.max(prev.periods_per_card ?? 1, periodsPerCard);
      if (teacherNames.length) {
        prev.teacher_names = [...new Set([...(prev.teacher_names ?? []), ...teacherNames])];
        prev.teacher_name = prev.teacher_names[0] ?? null;
      }
      if (teacherAscIds.length) {
        prev.teacher_asc_ids = [...new Set([...(prev.teacher_asc_ids ?? []), ...teacherAscIds])];
      }
    } else {
      buckets.set(k, {
        subject_name: sub,
        class_sections: [sec],
        weekly_hours: hours,
        teacher_tc: null,
        teacher_name: teacherNames[0] ?? null,
        teacher_names: teacherNames,
        teacher_asc_ids: teacherAscIds,
        room_asc_ids: roomAscIds,
        group_asc_id: groupAscId ?? null,
        day_distribution: cardDist,
        periods_per_card: periodsPerCard,
        _h: hours,
        _dist: cardDist,
      });
    }
  }

  let skippedNoSection = 0;

  for (const les of lessonSources) {
    const row = readLessonRow(les);
    const hours = lessonHours(row);
    const periodsPerCard = Math.max(1, Math.min(8, Math.round(row.periodsPerCard) || 1));
    const subjectName =
      row.subjectIds.map((id) => subjects.get(id)).find(Boolean) ??
      row.subjectName ??
      subjects.get(attr(les, 'subjectid', 'subjectId')) ??
      null;
    if (!subjectName?.trim()) continue;
    const teacherAscIds = row.teacherIds;
    const teacherNames = [
      ...teacherAscIds.map((id) => teachers.get(id)).filter(Boolean),
      ...(row.teacherNames ?? []),
    ].filter(Boolean) as string[];
    const groupAscId = row.groupIds[0] ?? null;

    if (row.classIds.length) {
      for (const cid of row.classIds) {
        add(
          subjectName,
          classes.get(cid) ?? cid,
          hours,
          periodsPerCard,
          teacherNames,
          teacherAscIds,
          row.roomIds,
          groupAscId,
        );
      }
    } else if (groupAscId) {
      const g = ascGroups.find((x) => x.asc_id === groupAscId);
      const sec = g ? classes.get(g.class_asc_id) ?? g.name : groupAscId;
      add(subjectName, sec, hours, periodsPerCard, teacherNames, teacherAscIds, row.roomIds, groupAscId);
    } else {
      skippedNoSection++;
      continue;
    }
  }

  if (skippedNoSection) {
    warnings.push({
      code: 'ASC_LESSON_NO_SECTION',
      message: `${skippedNoSection} ders satırında sınıf/şube yok; atlandı (ATÖLYE vb.).`,
    });
  }

  if (!buckets.size) {
    warnings.push({
      code: 'ASC_NO_LESSONS',
      message:
        'XML içinde ders (lesson/groupsubject/classsubject) bulunamadı. aSc: Dosya → Dışa aktar → aSc Timetables 2012 XML.',
    });
  }

  const assignments = [...buckets.values()].map(({ _h: _, _dist: __, ...r }) => ({
    ...r,
    weekly_hours: Math.max(1, r.weekly_hours),
    day_distribution:
      r.day_distribution?.length &&
      r.day_distribution.reduce((s, n) => s + n, 0) === Math.max(1, r.weekly_hours)
        ? r.day_distribution
        : buildAscCardDistribution(r.weekly_hours, r.periods_per_card ?? 1),
  }));

  if (ascRooms.length) {
    warnings.push({ code: 'ASC_ROOMS', message: `${ascRooms.length} derslik okundu.` });
  }
  if (ascClasses.length) {
    warnings.push({ code: 'ASC_CLASSES', message: `${ascClasses.length} şube (sınıf) okundu.` });
  }
  if (timeoffs.length) {
    warnings.push({ code: 'ASC_TIMEOFFS', message: `${timeoffs.length} kapalı/müsait olmayan slot okundu.` });
  }
  if (ascGroups.length) {
    warnings.push({ code: 'ASC_GROUPS', message: `${ascGroups.length} grup okundu.` });
  }

  const section_weekly_hours = buildAscSectionWeeklyHours(assignments);
  const max_period_count = parseAscMaxPeriodCount(root);
  const sectionCount = Object.keys(section_weekly_hours).length;
  if (sectionCount) {
    const totalH = Object.values(section_weekly_hours).reduce((s, n) => s + n, 0);
    warnings.push({
      code: 'ASC_SECTION_HOURS',
      message: `${sectionCount} şube için toplam ${totalH} haftalık ders saati; aSc ders sırası üst sınırı: ${max_period_count}.`,
    });
  }

  return {
    assignments,
    warnings,
    format: 'asc_xml',
    row_count: assignments.length,
    asc: {
      buildings: ascBuildings,
      rooms: ascRooms,
      classes: ascClasses,
      groups: ascGroups,
      timeoffs,
      teacher_by_id: Object.fromEntries(teachers),
      teacher_match_names: teacherMatchNames,
      teacher_meta_by_id: teacherMetaById,
      class_by_id: Object.fromEntries(classes),
      subject_by_id: Object.fromEntries(subjects),
      section_weekly_hours,
      max_period_count,
    },
  };
}
