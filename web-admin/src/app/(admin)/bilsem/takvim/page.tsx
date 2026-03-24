'use client';

import { useCallback, useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import {
  getCurrentWeekOrder,
  type WeekWithItems,
} from '@/components/academic-calendar/academic-calendar-timeline';
import { AcademicCalendarView } from '@/components/academic-calendar/academic-calendar-view';
import {
  Calendar,
  LayoutGrid,
  Clock,
  Sun,
  BarChart3,
  Pin,
  Star,
  CalendarDays,
} from 'lucide-react';

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

function useAcademicProgress() {
  const [now, setNow] = useState(() => new Date());
  const year = now.getFullYear() - (now.getMonth() < 8 ? 1 : 0);
  const start = new Date(year, 8, 1);
  const end = new Date(year + 1, 5, 15);
  const totalMs = end.getTime() - start.getTime();
  const elapsedMs = Math.max(0, now.getTime() - start.getTime());
  const remainingMs = Math.max(0, end.getTime() - now.getTime());
  const elapsedPct = totalMs > 0 ? Math.min(100, (elapsedMs / totalMs) * 100) : 0;
  const elapsedDays = Math.round(elapsedMs / (24 * 60 * 60 * 1000));
  const remainingDays = Math.round(remainingMs / (24 * 60 * 60 * 1000));
  const elapsed = { weeks: Math.floor(elapsedDays / 7), days: elapsedDays % 7, hours: now.getHours(), minutes: now.getMinutes(), seconds: now.getSeconds() };
  const remaining = { weeks: Math.floor(remainingDays / 7), days: remainingDays % 7, hours: 23 - now.getHours(), minutes: 59 - now.getMinutes(), seconds: 59 - now.getSeconds() };
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - (weekStart.getDay() || 7) + 1);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 4);
  const formatShort = (d: Date) => d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  const weekRange = `${formatShort(weekStart)}-${formatShort(weekEnd)}`;
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return { elapsed, remaining, elapsedPct, weekRange };
}

function TimeCard({
  icon: Icon,
  title,
  values,
  className,
}: {
  icon: typeof Clock;
  title: string;
  values: { weeks: number; days: number; hours: number; minutes: number; seconds: number };
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardContent className="pt-6">
        <div className="mb-4 flex items-center gap-2">
          <Icon className="size-5 text-muted-foreground" aria-hidden />
          <span className="text-sm font-medium text-muted-foreground">{title}</span>
        </div>
        <div className="flex flex-wrap gap-3">
          {[{ v: values.weeks, l: 'HAFTA' }, { v: values.days, l: 'GÜN' }, { v: values.hours, l: 'SAAT' }, { v: values.minutes, l: 'DAKİKA' }, { v: values.seconds, l: 'SANİYE' }].map(({ v, l }) => (
            <div key={l} className="flex flex-col items-center rounded-xl border border-border/60 bg-background/60 px-4 py-2.5 shadow-sm">
              <span className="text-xl font-bold tabular-nums">{v}</span>
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{l}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
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
  const progress = useAcademicProgress();

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-violet-800 px-6 py-8 shadow-xl shadow-violet-900/20 ring-1 ring-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent" />
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-white/20 shadow-lg backdrop-blur-sm">
              <Calendar className="size-8 text-white" aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                BİLSEM Takvim
                {isSchoolAdmin && me?.school?.name && (
                  <span className="ml-2 text-lg font-normal text-white/90">— {me.school.name}</span>
                )}
              </h1>
              <p className="mt-0.5 text-sm text-white/80">{academicYear} Eğitim Öğretim Yılı</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-sm font-medium text-white backdrop-blur focus:border-white/50 focus:outline-none focus:ring-2 focus:ring-white/20"
              aria-label="Öğretim yılı"
            >
              {getAcademicYears().map((y) => (
                <option key={y} value={y} className="bg-slate-800 text-white">
                  {y}
                </option>
              ))}
            </select>
            <div className="flex rounded-xl border border-white/25 bg-white/10 p-1 backdrop-blur-sm">
              <button
                type="button"
                onClick={() => setViewMode('week')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  viewMode === 'week' ? 'bg-white/20 text-white' : 'text-white/70 hover:text-white'
                }`}
                aria-pressed={viewMode === 'week'}
                aria-label="Hafta detayı görünümü"
                title="Seçili haftanın etkinliklerini detaylı gösterir"
              >
                <CalendarDays className="size-4" />
                Hafta Detayı
              </button>
              <button
                type="button"
                onClick={() => setViewMode('month')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  viewMode === 'month' ? 'bg-white/20 text-white' : 'text-white/70 hover:text-white'
                }`}
                aria-pressed={viewMode === 'month'}
                aria-label="Tüm haftalar görünümü"
                title="Tüm haftaları özet kartlar halinde gösterir"
              >
                <LayoutGrid className="size-4" />
                Tüm Haftalar
              </button>
            </div>
            {isSuperadmin && (
              <Button variant="secondary" size="sm" asChild className="border-white/20 bg-white/10 text-white hover:bg-white/20">
                <Link href="/bilsem-sablon?tab=is-plani">
                  <LayoutGrid className="mr-2 size-4" aria-hidden />
                  Şablon Düzenle
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Özet kartları */}
      <div className="grid gap-4 sm:grid-cols-2">
        <TimeCard icon={Clock} title="Geçen süre" values={progress.elapsed} className="border-slate-200/80 bg-gradient-to-br from-slate-50 to-slate-100/80 shadow-sm dark:border-slate-700 dark:from-slate-900/60 dark:to-slate-800/40" />
        <TimeCard icon={Sun} title="Kalan süre" values={progress.remaining} className="border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-emerald-100/80 shadow-sm dark:border-emerald-900/50 dark:from-emerald-950/40 dark:to-emerald-900/30" />
      </div>

      {/* İlerleme çubuğu */}
      <Card className="overflow-hidden border-border/60 shadow-sm">
        <CardContent className="pt-6">
          <div className="mb-3 flex items-center gap-2">
            <BarChart3 className="size-4 text-violet-600 dark:text-violet-400" aria-hidden />
            <span className="text-sm font-medium">Eğitim Öğretim Yılı İlerlemesi</span>
          </div>
          <div className="flex h-8 overflow-hidden rounded-full border border-border/40 bg-muted/50">
            <div className="flex items-center justify-center bg-gradient-to-r from-violet-500 to-violet-600 text-xs font-medium text-white shadow-inner transition-all duration-500" style={{ width: `${progress.elapsedPct}%` }}>
              {progress.elapsedPct >= 15 && <span>Geçen: %{progress.elapsedPct.toFixed(1)}</span>}
            </div>
            <div className="flex flex-1 items-center justify-center bg-gradient-to-r from-emerald-500 to-emerald-600 text-xs font-medium text-white shadow-inner">
              <span>Kalan: %{(100 - progress.elapsedPct).toFixed(1)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Şu an bu hafta */}
      {currentWeekOrder > 0 && (
        <Card className="overflow-hidden border-violet-200/60 bg-gradient-to-r from-violet-50/80 to-purple-50/80 shadow-sm dark:border-violet-900/30 dark:from-violet-950/30 dark:to-purple-950/30">
          <CardContent className="py-5">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="flex size-10 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/50">
                  <Pin className="size-5 text-violet-600 dark:text-violet-400" aria-hidden />
                </div>
                <span className="font-semibold">Şu an bu haftadasınız</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-md shadow-violet-500/25">
                  <Calendar className="size-3.5" aria-hidden />
                  {currentWeekOrder}. Hafta
                </span>
                <span className="rounded-xl border border-border/60 bg-background/80 px-4 py-2 text-sm font-medium text-muted-foreground">{progress.weekRange}</span>
                {etkinlikSayisi > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-xl bg-amber-100 px-4 py-2 text-sm font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                    <Star className="size-3.5" aria-hidden />
                    {etkinlikSayisi} etkinlik
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Takvim görünümü */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-foreground">Takvim</h2>

        {loading && (
          <div className="flex justify-center py-16">
            <LoadingSpinner />
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-destructive/50 bg-destructive/5 p-4 text-destructive">{error}</div>
        )}
        {!loading && !error && weeks.length === 0 && (
          <EmptyState
            icon={<Calendar className="size-10 text-muted-foreground" />}
            title="Henüz içerik yok"
            description={`${academicYear} için BİLSEM takvimi henüz yüklenmemiş. Farklı yıl seçmeyi deneyin veya okul yöneticisi ile iletişime geçin.`}
          />
        )}
        {!loading && !error && weeks.length > 0 && (
          <AcademicCalendarView
            weeks={weeks}
            view={viewMode}
            onViewChange={(v) => setViewMode(v)}
            defaultDate={new Date()}
            currentUserId={me?.id}
          />
        )}
      </div>
    </div>
  );
}
