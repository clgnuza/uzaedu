'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Sun,
  Sunset,
  CalendarOff,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { cn } from '@/lib/utils';
import { DutyPageHeader } from '@/components/duty/duty-page-header';

type DutySlotRow = {
  id: string;
  date: string;
  shift?: string | null;
  area_name?: string | null;
  slot_name?: string | null;
  lesson_num?: number | null;
};

const WEEKDAY_HEADERS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

/** Pazartesi = 0 … Pazar = 6 */
function mondayWeekIndex(d: Date): number {
  const day = d.getDay();
  return day === 0 ? 6 : day - 1;
}

function toYMD(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function monthRangeYm(ym: string): { from: string; to: string; label: string; year: number; month: number } {
  const [ys, ms] = ym.split('-');
  let y = parseInt(ys ?? '0', 10);
  let m = parseInt(ms ?? '1', 10);
  const now = new Date();
  if (!Number.isFinite(y) || y < 1970 || y > 2100 || !Number.isFinite(m) || m < 1 || m > 12) {
    y = now.getFullYear();
    m = now.getMonth() + 1;
  }
  const first = new Date(y, m - 1, 1);
  const last = new Date(y, m, 0);
  const label = first.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
  return { from: toYMD(first), to: toYMD(last), label, year: y, month: m };
}

type CalendarCell = {
  dateStr: string;
  inMonth: boolean;
  items: DutySlotRow[];
};

/** Ayın Pzt–Paz ızgarası: önceki/sonraki aydan tamamlayıcı günler dahil */
function buildCalendarCells(year: number, month: number, slotsByDate: Map<string, DutySlotRow[]>): CalendarCell[] {
  const firstOfMonth = new Date(year, month - 1, 1);
  const lastOfMonth = new Date(year, month, 0);
  const cur = new Date(firstOfMonth);
  cur.setDate(1 - mondayWeekIndex(firstOfMonth));
  const cells: CalendarCell[] = [];
  while (true) {
    const ds = toYMD(cur);
    const inMonth = cur.getMonth() === month - 1 && cur.getFullYear() === year;
    cells.push({ dateStr: ds, inMonth, items: slotsByDate.get(ds) ?? [] });
    cur.setDate(cur.getDate() + 1);
    if (cur > lastOfMonth && cells.length % 7 === 0) break;
    if (cells.length > 49) break;
  }
  return cells;
}

export default function DutyAylikListePage() {
  const { token, me } = useAuth();
  const isTeacher = me?.role === 'teacher';
  const [ym, setYm] = useState(() => toYMD(new Date()).slice(0, 7));
  const [slots, setSlots] = useState<DutySlotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [doubleShift, setDoubleShift] = useState(false);

  const { from, to, label, year, month } = useMemo(() => monthRangeYm(ym), [ym]);

  const fetchMonth = useCallback(async () => {
    if (!token || !isTeacher) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams({ from, to });
      const list = await apiFetch<DutySlotRow[]>(`/duty/daily-range?${qs.toString()}`, { token });
      setSlots(Array.isArray(list) ? list : []);
    } catch {
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }, [token, from, to, isTeacher]);

  useEffect(() => {
    if (!token || !isTeacher) return;
    apiFetch<{ duty_education_mode?: string }>('/duty/school-default-times', { token })
      .then((d) => setDoubleShift(d?.duty_education_mode === 'double'))
      .catch(() => setDoubleShift(false));
  }, [token, isTeacher]);

  useEffect(() => {
    fetchMonth();
  }, [fetchMonth]);

  const slotsByDate = useMemo(() => {
    const map = new Map<string, DutySlotRow[]>();
    for (const s of slots) {
      const arr = map.get(s.date) ?? [];
      arr.push(s);
      map.set(s.date, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => {
        const sh = (x: DutySlotRow) => (x.shift === 'afternoon' ? 1 : 0);
        if (sh(a) !== sh(b)) return sh(a) - sh(b);
        return (a.area_name ?? '').localeCompare(b.area_name ?? '');
      });
    }
    return map;
  }, [slots]);

  const calendarCells = useMemo(
    () => buildCalendarCells(year, month, slotsByDate),
    [year, month, slotsByDate],
  );

  const dutyDaysCount = useMemo(() => {
    let n = 0;
    for (const c of calendarCells) {
      if (c.inMonth && c.items.length > 0) n += 1;
    }
    return n;
  }, [calendarCells]);

  const shiftMonth = (delta: number) => {
    const [ys, ms] = ym.split('-').map((x) => parseInt(x, 10));
    const d = new Date(ys, ms - 1 + delta, 1);
    setYm(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  if (!isTeacher) {
    return (
      <Card className="rounded-2xl border-violet-200/50 bg-gradient-to-br from-violet-50/80 to-slate-50/50 dark:border-violet-900/40 dark:from-violet-950/30 dark:to-slate-900/50">
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <CalendarDays className="size-12 text-muted-foreground/60" />
          <div>
            <p className="font-medium text-foreground">Aylık liste öğretmen görünümüdür</p>
            <p className="mt-1 text-sm text-muted-foreground">Tüm nöbetçileri görmek için günlük tabloyu kullanın.</p>
          </div>
          <Button asChild variant="outline" className="rounded-xl">
            <Link href="/duty/gunluk-tablo">Günlük nöbet tablosu</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-5">
      <DutyPageHeader
        icon={CalendarDays}
        title="Aylık nöbet listesi"
        description="Ay seçerek nöbet günlerinizi görün."
        color="purple"
        actions={
          <Link
            href="/duty"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-background/90 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:text-sm"
          >
            <ArrowLeft className="size-3.5 sm:size-4" />
            Nöbet
          </Link>
        }
      />
      <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
          <Button
            variant="outline"
            size="sm"
            className="h-10 rounded-xl border-fuchsia-200/70 bg-fuchsia-50/50 dark:border-fuchsia-800/50 dark:bg-fuchsia-950/30"
            onClick={() => shiftMonth(-1)}
            aria-label="Önceki ay"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <div className="flex min-w-[12rem] items-center justify-center rounded-2xl border border-fuchsia-200/60 bg-gradient-to-r from-fuchsia-50/90 to-violet-50/70 px-4 py-2 text-sm font-semibold text-fuchsia-950 shadow-sm dark:border-fuchsia-800/40 dark:from-fuchsia-950/40 dark:to-violet-950/30 dark:text-fuchsia-100">
            <CalendarDays className="mr-2 size-4 shrink-0 text-fuchsia-600 dark:text-fuchsia-400" aria-hidden />
            <input
              type="month"
              value={ym}
              onChange={(e) => setYm(e.target.value)}
              className="min-w-0 flex-1 border-0 bg-transparent text-center font-semibold focus:outline-none focus:ring-0"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-10 rounded-xl border-fuchsia-200/70 bg-fuchsia-50/50 dark:border-fuchsia-800/50 dark:bg-fuchsia-950/30"
            onClick={() => shiftMonth(1)}
            aria-label="Sonraki ay"
          >
            <ChevronRight className="size-4" />
          </Button>
      </div>

      <Card className="overflow-hidden rounded-xl border-2 border-fuchsia-300/60 bg-gradient-to-b from-white via-fuchsia-50/25 to-violet-50/25 shadow-lg shadow-fuchsia-500/15 ring-1 ring-fuchsia-200/80 dark:border-fuchsia-700/50 dark:from-slate-950 dark:via-fuchsia-950/15 dark:to-violet-950/25 dark:ring-fuchsia-800/40 sm:rounded-2xl">
        <CardHeader className="border-b border-fuchsia-200/40 bg-gradient-to-r from-fuchsia-100/50 to-violet-100/40 py-2.5 sm:py-4 dark:border-fuchsia-800/30 dark:from-fuchsia-950/40 dark:to-violet-950/30">
          <CardTitle className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-base font-semibold text-fuchsia-950 dark:text-fuchsia-100">
            <span className="capitalize">{label}</span>
            <span className="text-xs font-normal text-fuchsia-700/85 dark:text-fuchsia-300/85 sm:text-sm">
              {slots.length > 0
                ? `· ${dutyDaysCount} nöbet günü · ${slots.length} kayıt`
                : '· Bu ay nöbet yok'}
            </span>
          </CardTitle>
          {doubleShift && (
            <p className="text-[11px] text-muted-foreground">S / Ö: sabah / öğle (çift vardiya).</p>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-16">
              <LoadingSpinner />
            </div>
          ) : (
            <div className="p-2 sm:p-4">
              {!loading && slots.length === 0 && (
                <p className="mb-3 flex items-center gap-2 rounded-lg border border-amber-200/60 bg-amber-50/70 px-3 py-2 text-xs text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-200">
                  <CalendarOff className="size-4 shrink-0 opacity-80" aria-hidden />
                  Seçilen ay için yayınlanmış planda atanmış nöbet bulunmuyor; takvim yine de ayın yapısını gösterir.
                </p>
              )}
              <div
                className={cn(
                  'overflow-hidden rounded-t-xl border-2 border-fuchsia-400/70 bg-fuchsia-200/90 shadow-inner dark:border-fuchsia-600/60 dark:bg-fuchsia-950/70',
                )}
              >
                <div className="grid grid-cols-7 divide-x divide-fuchsia-400/50 dark:divide-fuchsia-700/50">
                  {WEEKDAY_HEADERS.map((h) => (
                    <div
                      key={h}
                      className="px-0.5 py-2.5 text-center text-[11px] font-bold uppercase tracking-wide text-fuchsia-950 sm:py-3 sm:text-xs dark:text-fuchsia-50"
                    >
                      {h}
                    </div>
                  ))}
                </div>
              </div>
              <div
                className={cn(
                  'grid grid-cols-7 divide-x divide-y divide-fuchsia-300/80 overflow-hidden rounded-b-xl border-2 border-t-0 border-fuchsia-400/70 bg-white shadow-md dark:divide-fuchsia-700/50 dark:border-fuchsia-600/60 dark:bg-slate-950/40',
                )}
              >
                {calendarCells.map((cell) => {
                  const d = new Date(cell.dateStr + 'T12:00:00');
                  const dayNum = d.getDate();
                  const wIdx = mondayWeekIndex(d);
                  const isWeekend = wIdx >= 5;
                  const has = cell.items.length > 0;
                  return (
                    <div
                      key={cell.dateStr}
                      className={cn(
                        'flex min-h-[4.25rem] flex-col gap-1 p-1.5 sm:min-h-[5.25rem] sm:p-2',
                        !cell.inMonth && 'bg-slate-100/90 text-muted-foreground dark:bg-slate-900/70',
                        cell.inMonth && !has && 'bg-white dark:bg-slate-950/50',
                        cell.inMonth && has &&
                          'bg-gradient-to-br from-fuchsia-100 via-white to-violet-100 shadow-[inset_0_0_0_2px_rgba(192,38,211,0.35)] dark:from-fuchsia-950/70 dark:via-fuchsia-950/40 dark:to-violet-950/50 dark:shadow-[inset_0_0_0_2px_rgba(217,70,239,0.45)]',
                        cell.inMonth && isWeekend && !has && 'bg-violet-50/90 dark:bg-violet-950/35',
                      )}
                    >
                      <span
                        className={cn(
                          'text-xs font-bold tabular-nums leading-none sm:text-sm',
                          !cell.inMonth && 'opacity-70',
                          cell.inMonth && !has && 'text-foreground',
                          has && cell.inMonth && 'text-fuchsia-950 dark:text-fuchsia-50',
                        )}
                      >
                        {dayNum}
                      </span>
                      {has ? (
                        <div className="flex min-w-0 flex-col gap-1">
                          {cell.items.map((s) => {
                            const isAfternoon = s.shift === 'afternoon';
                            const area = s.area_name || s.slot_name || 'Nöbet';
                            return (
                              <div
                                key={s.id}
                                title={`${isAfternoon ? 'Öğle' : 'Sabah'} · ${area}`}
                                className={cn(
                                  'flex min-w-0 items-center gap-1 rounded-md border px-1 py-0.5 text-[10px] font-semibold leading-tight shadow-sm sm:text-[11px]',
                                  isAfternoon
                                    ? 'border-amber-400/70 bg-amber-100/95 text-amber-950 dark:border-amber-600/50 dark:bg-amber-950/55 dark:text-amber-50'
                                    : 'border-sky-400/70 bg-sky-100/95 text-sky-950 dark:border-sky-600/50 dark:bg-sky-950/55 dark:text-sky-50',
                                )}
                              >
                                <span className="inline-flex size-4 shrink-0 items-center justify-center rounded bg-white/90 text-[10px] font-black text-current shadow-sm dark:bg-slate-900/80">
                                  {isAfternoon ? 'Ö' : 'S'}
                                </span>
                                <span className="min-w-0 flex-1 truncate">{area}</span>
                                {s.lesson_num != null && s.lesson_num > 0 && (
                                  <span className="shrink-0 text-[9px] font-bold opacity-80">({s.lesson_num})</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t-2 border-fuchsia-200/70 pt-4 text-xs font-medium text-foreground dark:border-fuchsia-800/50">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-300/70 bg-sky-50 px-2.5 py-1 dark:border-sky-700/50 dark:bg-sky-950/40">
                  <Sun className="size-4 text-sky-600 dark:text-sky-400" aria-hidden /> Sabah (S)
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/70 bg-amber-50 px-2.5 py-1 dark:border-amber-700/50 dark:bg-amber-950/40">
                  <Sunset className="size-4 text-amber-600 dark:text-amber-400" aria-hidden /> Öğle (Ö)
                </span>
                <span className="text-muted-foreground">Nöbetli günler renkli çerçeve ile belirginleştirilir.</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-[11px] text-muted-foreground sm:text-left">
        Liste yalnızca <strong className="font-medium text-foreground">yayınlanmış</strong> nöbet planlarından gelir.
      </p>
    </div>
  );
}
