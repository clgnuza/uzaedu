'use client';

import type { EditorContext } from '@/lib/ders-dagit-timetable-api';

export function TimetableWorkload({ fairness }: { fairness: EditorContext['fairness'] }) {
  if (!fairness?.ready || !fairness.teacher_stats?.length) {
    return <p className="text-xs text-muted-foreground">Yük verisi yok.</p>;
  }
  const max = Math.max(...fairness.teacher_stats.map((t) => t.lesson_count), 1);
  const avg = fairness.avg_lessons_per_teacher ?? 0;
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Ortalama <strong>{avg}</strong> saat / öğretmen
      </p>
      <ul className="max-h-36 space-y-1.5 overflow-y-auto">
        {fairness.teacher_stats
          .slice()
          .sort((a, b) => b.lesson_count - a.lesson_count)
          .slice(0, 12)
          .map((t) => (
            <li key={t.teacher_id} className="text-[10px]">
              <div className="mb-0.5 flex justify-between gap-1">
                <span className="truncate font-medium">{t.label}</span>
                <span className="shrink-0 tabular-nums">{t.lesson_count}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary/70"
                  style={{ width: `${Math.round((t.lesson_count / max) * 100)}%` }}
                />
              </div>
            </li>
          ))}
      </ul>
    </div>
  );
}
