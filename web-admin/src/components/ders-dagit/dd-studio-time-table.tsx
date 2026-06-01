'use client';

import { weekdayShort } from '@/lib/studio-timetable-ui';
import { cn } from '@/lib/utils';
import { Check, HelpCircle, ShieldCheck, X } from 'lucide-react';

export type StudioCellVisual = {
  state: 'available' | 'blocked' | 'conditional' | 'disabled' | 'approved' | 'denied';
  fill?: 'none' | 'scheduled' | 'locked';
  title?: string;
};

type Props = {
  workDays: number[];
  maxLessons: number;
  getCell: (day: number, lesson: number) => StudioCellVisual;
  onCell?: (day: number, lesson: number, button: 0 | 2) => void;
  onDayHeader?: (day: number) => void;
  readOnly?: boolean;
  showLegend?: boolean;
  hint?: string;
};

function CellIcon({ state }: { state: StudioCellVisual['state'] }) {
  if (state === 'blocked') return <X className="size-3.5 text-rose-700 dark:text-rose-300" aria-hidden />;
  if (state === 'approved')
    return <ShieldCheck className="size-3.5 text-violet-800 dark:text-violet-200" aria-hidden />;
  if (state === 'denied') return <Check className="size-3.5 text-amber-800 dark:text-amber-200" aria-hidden />;
  if (state === 'conditional') return <HelpCircle className="size-3.5 text-sky-700 dark:text-sky-300" aria-hidden />;
  if (state === 'available') return <Check className="size-3.5 text-emerald-700 dark:text-emerald-300" aria-hidden />;
  return null;
}

export function DdStudioTimeTable({
  workDays,
  maxLessons,
  getCell,
  onCell,
  onDayHeader,
  readOnly,
  showLegend = true,
  hint,
}: Props) {
  const days = workDays.length ? workDays : [1, 2, 3, 4, 5];
  const lessons = Array.from({ length: maxLessons }, (_, i) => i + 1);

  return (
    <div className="space-y-2">
      {showLegend && (
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground" role="list" aria-label="Zaman tablosu">
          <span className="inline-flex items-center gap-1" role="listitem">
            <Check className="size-3 text-emerald-600" aria-hidden /> Uygun
          </span>
          <span className="inline-flex items-center gap-1" role="listitem">
            <HelpCircle className="size-3 text-sky-600" aria-hidden /> Şartlı
          </span>
          <span className="inline-flex items-center gap-1" role="listitem">
            <X className="size-3 text-rose-600" aria-hidden /> Uygun değil
          </span>
        </div>
      )}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
        <table className="w-full min-w-[20rem] border-collapse text-center text-xs" role="grid">
          <thead>
            <tr>
              <th className="border-b bg-muted/80 px-2 py-1.5 font-medium w-10" scope="col" />
              {lessons.map((l) => (
                <th key={l} className="border-b bg-muted/50 px-1 py-1.5 font-medium min-w-[2rem]" scope="col">
                  {l}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d}>
                <th scope="row" className="border-r bg-muted/40 px-2 py-1 font-semibold text-muted-foreground">
                  {onDayHeader && !readOnly ? (
                    <button
                      type="button"
                      className="rounded px-1 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => onDayHeader(d)}
                    >
                      {weekdayShort(d)}
                    </button>
                  ) : (
                    weekdayShort(d)
                  )}
                </th>
                {lessons.map((lesson) => {
                  const v = getCell(d, lesson);
                  const disabled = v.state === 'disabled' || readOnly || !onCell;
                  return (
                    <td key={lesson} className="border-b border-r p-0.5">
                      <button
                        type="button"
                        disabled={disabled}
                        title={v.title}
                        className={cn(
                          'flex h-8 w-full items-center justify-center rounded-sm transition-colors',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          v.state === 'blocked' && 'bg-rose-100 ring-1 ring-rose-400/50 dark:bg-rose-950/40',
                          v.state === 'approved' &&
                            'bg-violet-100 ring-2 ring-violet-500/60 dark:bg-violet-950/50',
                          v.state === 'denied' &&
                            'bg-amber-50 ring-2 ring-amber-400/70 dark:bg-amber-950/35',
                          v.state === 'conditional' && 'bg-sky-100 dark:bg-sky-950/40',
                          v.state === 'available' && 'bg-emerald-50/80 dark:bg-emerald-950/20',
                          v.state === 'disabled' && 'bg-muted/30 cursor-not-allowed opacity-60',
                          v.fill === 'scheduled' && 'bg-zinc-300/70 dark:bg-zinc-700/50',
                          v.fill === 'locked' && 'bg-sky-200/80 dark:bg-sky-900/50',
                        )}
                        onClick={(e) => onCell?.(d, lesson, e.button === 2 ? 2 : 0)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          onCell?.(d, lesson, 2);
                        }}
                      >
                        <CellIcon state={v.state} />
                        <span className="sr-only">{v.title ?? v.state}</span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!readOnly && (
        <p className="text-[11px] text-muted-foreground">
          Sol tık: ileri · Sağ tık / menü: geri (uygun → uygun değil → şartlı)
        </p>
      )}
    </div>
  );
}
