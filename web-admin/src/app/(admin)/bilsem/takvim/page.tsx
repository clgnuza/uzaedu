'use client';

import { useCallback, useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import {
  getCurrentWeekOrder,
  type WeekWithItems,
} from '@/components/academic-calendar/academic-calendar-timeline';
import { AcademicCalendarView } from '@/components/academic-calendar/academic-calendar-view';
import { Calendar, ChevronRight, Home, LayoutGrid } from 'lucide-react';

type BilsemItem = {
  id: string;
  title: string;
  path: string | null;
  iconKey: string | null;
  sortOrder: number;
  itemType: string;
  assignedUsers?: { userId: string; displayName: string | null; gorevTipi: string }[];
};

type BilsemWeek = {
  id: string;
  academicYear: string;
  weekNumber: number;
  title: string | null;
  dateStart: string | null;
  dateEnd: string | null;
  sortOrder: number;
  items: BilsemItem[];
};

function useAcademicYearProgressPct() {
  const [now, setNow] = useState(() => new Date());
  const year = now.getFullYear() - (now.getMonth() < 8 ? 1 : 0);
  const start = new Date(year, 8, 1);
  const end = new Date(year + 1, 5, 15);
  const totalMs = end.getTime() - start.getTime();
  const elapsedMs = Math.max(0, now.getTime() - start.getTime());
  const elapsedPct = totalMs > 0 ? Math.min(100, (elapsedMs / totalMs) * 100) : 0;
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - (weekStart.getDay() || 7) + 1);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 4);
  const formatShort = (d: Date) => d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  const weekRange = `${formatShort(weekStart)}–${formatShort(weekEnd)}`;
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  return { elapsedPct, weekRange };
}

function getAcademicYears(): string[] {
  const now = new Date();
  const startYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  const years: string[] = [];
  for (let i = -1; i < 5; i++) {
    years.push(`${startYear + i}-${startYear + i + 1}`);
  }
  return years.sort((a, b) => b.localeCompare(a));
}

function transformBilsemToWeekWithItems(weeks: BilsemWeek[]): WeekWithItems[] {
  return weeks.map((w) => {
    const belirliGunHafta = w.items
      .filter((i) => ['belirli_gun_hafta', 'dep'].includes(i.itemType))
      .map((i) => ({
        id: i.id,
        title: i.title,
        path: i.path,
        iconKey: i.iconKey,
        sortOrder: i.sortOrder,
        assignedUsers: i.assignedUsers?.map((u) => ({
          ...u,
          gorevTipi: u.gorevTipi === 'yardimci' ? ('yardimci' as const) : ('sorumlu' as const),
        })),
      }));
    const ogretmenIsleri = w.items
      .filter((i) => ['tanilama', 'diger'].includes(i.itemType))
      .map((i) => ({ id: i.id, title: i.title, path: i.path, iconKey: i.iconKey, sortOrder: i.sortOrder }));
    return {
      id: w.id,
      academicYear: w.academicYear,
      weekNumber: w.weekNumber,
      title: w.title,
      dateStart: w.dateStart,
      dateEnd: w.dateEnd,
      sortOrder: w.sortOrder,
      belirliGunHafta,
      ogretmenIsleri,
    };
  });
}

type CalendarViewMode = 'week' | 'month';

export default function BilsemTakvimPage() {
  const { token, me } = useAuth();
  const [bilsemWeeks, setBilsemWeeks] = useState<BilsemWeek[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<CalendarViewMode>('week');
  const isSchoolAdmin = me?.role === 'school_admin';
  const isSuperadmin = me?.role === 'superadmin';
  const [academicYear, setAcademicYear] = useState(() => {
    const now = new Date();
    return now.getMonth() >= 8 ? `${now.getFullYear()}-${now.getFullYear() + 1}` : `${now.getFullYear() - 1}-${now.getFullYear()}`;
  });
  const progress = useAcademicYearProgressPct();

  const weeks = useMemo(() => transformBilsemToWeekWithItems(bilsemWeeks), [bilsemWeeks]);
  const currentWeekOrder = getCurrentWeekOrder(weeks);
  const currentWeekData = weeks.find((w) => w.weekNumber === currentWeekOrder);
  const etkinlikSayisi = (currentWeekData?.belirliGunHafta?.length ?? 0) + (currentWeekData?.ogretmenIsleri?.length ?? 0);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<BilsemWeek[]>(`/bilsem/calendar?academic_year=${encodeURIComponent(academicYear)}`, { token });
      setBilsemWeeks(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Yüklenemedi');
      setBilsemWeeks([]);
    } finally {
      setLoading(false);
    }
  }, [token, academicYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const subLine = [
    academicYear,
    weeks.length > 0 ? `${weeks.length} hafta` : null,
    currentWeekOrder > 0 ? `H${currentWeekOrder}` : null,
    etkinlikSayisi > 0 ? `${etkinlikSayisi} etkinlik` : null,
    `%${progress.elapsedPct.toFixed(0)} yıl`,
    progress.weekRange,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="space-y-2 px-1.5 py-1 sm:space-y-4 sm:px-0 sm:py-0">
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border/80 bg-linear-to-r from-violet-500/12 via-fuchsia-500/8 to-sky-500/10 px-1.5 py-1 shadow-sm dark:from-violet-950/30 dark:via-fuchsia-950/20 dark:to-sky-950/25 sm:gap-2 sm:rounded-xl sm:px-3 sm:py-2">
        <Link
          href="/dashboard"
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background/80 hover:text-primary sm:size-8 sm:rounded-lg"
          aria-label="Anasayfa"
        >
          <Home className="size-4 sm:size-[18px]" />
        </Link>
        <ChevronRight className="size-2.5 shrink-0 text-muted-foreground/70 sm:size-3" aria-hidden />
        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-violet-600/90 text-white shadow-sm ring-1 ring-violet-500/30 dark:bg-violet-600 sm:size-9 sm:rounded-lg">
          <Calendar className="size-3.5 sm:size-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 basis-[min(100%,12rem)]">
          <h1 className="text-xs font-bold leading-tight text-foreground sm:text-base">
            Bilsem takvim
            {isSchoolAdmin && me?.school?.name && (
              <span className="font-normal text-muted-foreground sm:ml-1"> — {me.school.name}</span>
            )}
          </h1>
          <p className="truncate text-[10px] text-muted-foreground sm:text-xs" title={subLine}>
            {subLine}
          </p>
        </div>
        <div className="flex w-full shrink-0 items-center gap-1.5 sm:w-auto sm:flex-nowrap">
          <label htmlFor="bilsem-ay" className="sr-only">
            Öğretim yılı
          </label>
          <select
            id="bilsem-ay"
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            className="h-8 min-w-0 flex-1 rounded-md border border-border/80 bg-background/90 px-2 text-[11px] font-medium shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40 sm:h-9 sm:min-w-[7.5rem] sm:flex-none sm:rounded-lg sm:px-3 sm:text-sm"
          >
            {getAcademicYears().map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          {isSuperadmin && (
            <Button variant="outline" size="sm" className="h-8 shrink-0 gap-1 px-2 text-[11px] sm:h-9 sm:px-3 sm:text-sm" asChild>
              <Link href="/bilsem-sablon?tab=is-plani" title="Şablon düzenle">
                <LayoutGrid className="size-3.5 sm:size-4" aria-hidden />
                <span className="hidden sm:inline">Şablon</span>
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div
        className="rounded-lg border border-border/60 bg-card/80 px-2 py-1.5 shadow-sm sm:px-3 sm:py-2"
        role="status"
        aria-label={`Eğitim öğretim yılı doluluk yüzdesi %${progress.elapsedPct.toFixed(0)}`}
      >
        <div className="mb-1 flex items-center justify-between gap-2 text-[10px] text-muted-foreground sm:text-xs">
          <span>Yıl ilerlemesi</span>
          <span className="tabular-nums font-medium text-foreground">%{progress.elapsedPct.toFixed(0)}</span>
        </div>
        <div className="flex h-1.5 overflow-hidden rounded-full bg-muted sm:h-2">
          <div
            className="rounded-full bg-linear-to-r from-violet-500 to-sky-500 transition-all duration-500 dark:from-violet-500 dark:to-sky-400"
            style={{ width: `${progress.elapsedPct}%` }}
          />
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-10 sm:py-16">
          <LoadingSpinner />
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>
      )}
      {!loading && !error && weeks.length === 0 && (
        <EmptyState
          icon={<Calendar className="size-10 text-muted-foreground" />}
          title="Henüz içerik yok"
          description={`${academicYear} için Bilsem takvimi henüz yüklenmemiş. Farklı yıl seçin veya okul yöneticisi ile iletişin.`}
        />
      )}
      {!loading && !error && weeks.length > 0 && (
        <AcademicCalendarView
          weeks={weeks}
          view={viewMode}
          onViewChange={(v) => setViewMode(v)}
          defaultDate={new Date()}
          currentUserId={me?.id}
          className="space-y-3 sm:space-y-5"
        />
      )}
    </div>
  );
}
