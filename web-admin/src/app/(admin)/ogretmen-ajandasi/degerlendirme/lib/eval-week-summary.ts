import { addWeeks, endOfWeek, format, startOfWeek } from 'date-fns';
import { tr } from 'date-fns/locale';

export type WeekBoundStrings = { weekStart: string; weekEnd: string; label: string };

export function getWeekBounds(weekOffset: number): WeekBoundStrings {
  const ref = addWeeks(new Date(), weekOffset);
  const ws = startOfWeek(ref, { weekStartsOn: 1 });
  const we = endOfWeek(ref, { weekStartsOn: 1 });
  const weekStart = format(ws, 'yyyy-MM-dd');
  const weekEnd = format(we, 'yyyy-MM-dd');
  const label =
    format(ws, 'd MMM', { locale: tr }) + ' – ' + format(we, 'd MMM yyyy', { locale: tr });
  return { weekStart, weekEnd, label };
}

type Crit = { id: string; scoreType?: 'numeric' | 'sign' };
type Sc = { studentId: string; criterionId: string; score: number; noteDate: string };
type N = { studentId: string; noteType: string; noteDate: string };

export type WeekStudentRow = {
  studentId: string;
  name: string;
  scoreSum: number;
  scoreCount: number;
  pos: number;
  neg: number;
};

export function buildWeekSummary(
  students: { id: string; name: string }[],
  scores: Sc[],
  notes: N[],
  criteria: Crit[],
  weekStart: string,
  weekEnd: string,
): WeekStudentRow[] {
  const critMap = new Map(criteria.map((c) => [c.id, c]));
  const inWeek = (d: string) => d >= weekStart && d <= weekEnd;
  const byStudent = new Map<string, { scoreSum: number; scoreCount: number; pos: number; neg: number }>();

  for (const s of students) {
    byStudent.set(s.id, { scoreSum: 0, scoreCount: 0, pos: 0, neg: 0 });
  }

  for (const sc of scores) {
    if (!inWeek(sc.noteDate)) continue;
    const row = byStudent.get(sc.studentId);
    if (!row) continue;
    const c = critMap.get(sc.criterionId);
    const v = (c?.scoreType ?? 'numeric') === 'sign' ? sc.score : sc.score;
    row.scoreSum += v;
    row.scoreCount += 1;
  }

  for (const n of notes) {
    if (!inWeek(n.noteDate)) continue;
    const row = byStudent.get(n.studentId);
    if (!row) continue;
    if (n.noteType === 'positive') row.pos += 1;
    else if (n.noteType === 'negative') row.neg += 1;
  }

  return students
    .map((s) => {
      const r = byStudent.get(s.id)!;
      return { studentId: s.id, name: s.name, ...r };
    })
    .sort((a, b) => {
      const act = (x: WeekStudentRow) => Math.abs(x.scoreSum) + x.scoreCount + x.pos + x.neg;
      return act(b) - act(a) || b.scoreSum - a.scoreSum || a.name.localeCompare(b.name, 'tr');
    });
}
