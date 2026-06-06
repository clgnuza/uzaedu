/**
 * Sürükle-bırak durum ızgarası — sınıf/öğretmen tek tablo ölçeğinde süre üst sınırı.
 * Çalıştır: npx --yes tsx src/lib/timetable-dnd-perf.test.ts
 */
import { buildDropStatusGrid } from './timetable-slot-status';
import type { EditorEntry } from './ders-dagit-timetable-api';

function makeEntries(n: number): EditorEntry[] {
  const out: EditorEntry[] = [];
  for (let i = 0; i < n; i++) {
    const day = (i % 5) + 1;
    const lesson = (i % 8) + 1;
    out.push({
      id: `e-${i}`,
      class_section: `9-${(i % 12) + 1}`,
      subject: 'Matematik',
      day_of_week: day,
      lesson_num: lesson,
      user_id: `t-${i % 40}`,
      teacher_label: `Öğretmen ${i % 40}`,
      room_id: null,
      room_name: null,
      is_locked: false,
      assignment_id: `a-${i % 80}`,
    } as EditorEntry);
  }
  return out;
}

const entries = makeEntries(1200);
const dragging = entries[0]!;
const days = [1, 2, 3, 4, 5];
const maxLesson = 8;

const t0 = performance.now();
for (let run = 0; run < 20; run++) {
  buildDropStatusGrid({
    dragging,
    poolClassSection: null,
    blockDragIds: null,
    days,
    maxLesson,
    lessonsPerDayByDow: {},
    entries,
    forbidden: new Set(),
  });
}
const avgMs = (performance.now() - t0) / 20;

if (avgMs > 25) {
  console.error(`FAIL buildDropStatusGrid avg ${avgMs.toFixed(1)}ms > 25ms`);
  process.exit(1);
}
console.log(`OK buildDropStatusGrid avg ${avgMs.toFixed(1)}ms (1200 entry, 40 slot)`);
