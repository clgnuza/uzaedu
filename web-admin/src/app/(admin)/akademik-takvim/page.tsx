'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
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
import { cn } from '@/lib/utils';
import {
  Calendar,
  Settings,
  LayoutGrid,
  Clock,
  Sun,
  BarChart3,
  Pin,
  Star,
  CalendarDays,
  LayoutList,
  Info,
  ChevronDown,
} from 'lucide-react';

function TakvimSayfaBilgi({
  isTeacher,
  showStaffNote,
}: {
  isTeacher: boolean;
  showStaffNote: boolean;
}) {
  return (
    <details className="group mt-1.5 rounded-md border border-border/70 bg-muted/15 open:bg-muted/25 dark:border-border dark:bg-muted/10 sm:mt-2 sm:rounded-lg">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-2 py-1.5 text-[11px] font-medium text-foreground marker:content-none [&::-webkit-details-marker]:hidden hover:bg-muted/30 sm:gap-2 sm:px-2.5 sm:py-2 sm:text-xs md:text-sm">
        <Info className="size-3.5 shrink-0 text-indigo-600 dark:text-indigo-400" aria-hidden />
        <span>Bu sayfa nasıl kullanılır?</span>
        <ChevronDown
          className="ml-auto size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180 md:size-4"
          aria-hidden
        />
      </summary>
      <div className="space-y-1 border-t border-border/60 px-2 py-1.5 text-[10px] leading-snug text-muted-foreground sm:space-y-1.5 sm:px-2.5 sm:py-2 sm:text-xs md:space-y-2 md:py-2.5 md:text-sm md:leading-relaxed">
        {isTeacher ? (
          <>
            <p>
              <span className="font-medium text-foreground">Hafta seçimi:</span> Üstte sabit kalan çubuktaki açılır listeden haftaya gidebilir,{' '}
              <span className="font-medium text-foreground">Hafta</span> ve <span className="font-medium text-foreground">Liste</span> görünümleri arasında geçiş
              yapabilirsiniz. İleri ve geri okları veya &quot;Bugünün haftası&quot; ile hızlıca konumlanırsınız.
            </p>
            <p>
              <span className="font-medium text-foreground">Mobil:</span> Hızlı hafta şeridini parmakla yana kaydırarak yakın haftalara geçin; seçili haftanın etkinlikleri
              aşağıda listelenir.
            </p>
            <p>
              <span className="font-medium text-foreground">Renkler:</span> Turuncu tonlar belirli gün ve haftaları, mavi tonlar öğretmen işlerini gösterir. Size atanan görevlerde
              &quot;Sizin&quot; etiketi çıkar.
            </p>
          </>
        ) : (
          <ul className="list-inside list-disc space-y-1.5">
            <li>
              Kaydırırken üstte sabit kalan bardan <span className="font-medium text-foreground">hafta seçin</span> veya{' '}
              <span className="font-medium text-foreground">Hafta / Liste</span> görünümünü değiştirin.
            </li>
            <li>Hızlı şeritte yana kaydırarak yakın haftalara geçebilirsiniz (mobil).</li>
            <li>İleri / geri düğmeleri ve hafta açılır listesi aynı içeriğe farklı yollardan ulaşmanızı sağlar.</li>
            <li>Turuncu: belirli gün ve haftalar; mavi: öğretmen işleri. Görevlendirme satırlarında sorumlu ve yardımcı öğretmenler gösterilir.</li>
            {showStaffNote && (
              <li>
                Okul yöneticileri takvimi <span className="font-medium text-foreground">Ayarlar</span> ile; üst yönetim <span className="font-medium text-foreground">Şablon</span>{' '}
                ekranı ile düzenleyebilir.
              </li>
            )}
          </ul>
        )}
      </div>
    </details>
  );
}

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
  const weekOfYear = Math.max(1, Math.floor(elapsedDays / 7) + 1);
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
  return { elapsed, remaining, elapsedPct, elapsedDays, remainingDays, weekOfYear, weekRange };
}

function DurationTableMobile({
  elapsed,
  remaining,
}: {
  elapsed: { weeks: number; days: number; hours: number; minutes: number; seconds: number };
  remaining: { weeks: number; days: number; hours: number; minutes: number; seconds: number };
}) {
  const cols = ['hft', 'g', 's', 'dk', 'sn'] as const;
  const row = (v: typeof elapsed) => [v.weeks, v.days, v.hours, v.minutes, v.seconds];
  return (
    <Card className="border-zinc-200/70 bg-zinc-50/40 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/50 md:hidden">
      <CardContent className="px-2.5 py-2">
        <p className="mb-1.5 text-center text-[10px] font-medium tracking-wide text-zinc-500 dark:text-zinc-400">Öğretim yılı süresi</p>
        <div className="grid grid-cols-[3.25rem_repeat(5,minmax(0,1fr))] gap-x-0.5 gap-y-0.5 text-[10px] tabular-nums">
          <div />
          {cols.map((c) => (
            <div key={c} className="text-center text-[8px] font-semibold uppercase text-zinc-400 dark:text-zinc-500">
              {c}
            </div>
          ))}
          <div className="flex items-center gap-1 text-zinc-600 dark:text-zinc-300">
            <Clock className="size-3 shrink-0 text-indigo-500 opacity-80" aria-hidden />
            <span className="font-medium">Geçen</span>
          </div>
          {row(elapsed).map((n, i) => (
            <div key={`e-${i}`} className="flex items-center justify-center rounded-md bg-white/90 py-0.5 text-[11px] font-semibold text-zinc-900 dark:bg-zinc-900/80 dark:text-zinc-100">
              {n}
            </div>
          ))}
          <div className="flex items-center gap-1 text-zinc-600 dark:text-zinc-300">
            <Sun className="size-3 shrink-0 text-teal-600 opacity-80" aria-hidden />
            <span className="font-medium">Kalan</span>
          </div>
          {row(remaining).map((n, i) => (
            <div key={`r-${i}`} className="flex items-center justify-center rounded-md bg-teal-50/90 py-0.5 text-[11px] font-semibold text-teal-950 dark:bg-teal-950/40 dark:text-teal-100">
              {n}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
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
    <Card
      className={cn(
        'hidden overflow-hidden border-zinc-200/90 shadow-sm dark:border-zinc-800/80 md:block',
        className,
      )}
    >
      <CardContent className="px-3 py-2.5 md:px-4 md:py-3">
        <div className="mb-1.5 flex items-center gap-1.5 md:mb-2">
          <Icon className="size-3.5 shrink-0 text-muted-foreground md:size-4" aria-hidden />
          <span className="text-[11px] font-medium text-muted-foreground md:text-xs">{title}</span>
        </div>
        <div className="flex flex-wrap gap-1.5 md:gap-2">
          {(
            [
              { v: values.weeks, long: 'HAFTA' },
              { v: values.days, long: 'GÜN' },
              { v: values.hours, long: 'SAAT' },
              { v: values.minutes, long: 'DAKİKA' },
              { v: values.seconds, long: 'SANİYE' },
            ] as const
          ).map(({ v, long }) => (
            <div
              key={long}
              className="flex min-w-14 flex-1 flex-col items-center justify-center rounded-md border bg-muted/30 px-1.5 py-1 md:min-w-0 md:px-2 md:py-1.5"
            >
              <span className="text-base font-bold tabular-nums leading-none md:text-lg">{v}</span>
              <span className="mt-0.5 text-[9px] leading-none text-muted-foreground md:text-[10px]">{long}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

const DEFAULT_ACADEMIC_YEAR = '2025-2026';

function getAcademicYears(): string[] {
  const years = new Set<string>();
  const now = new Date();
  const startYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  for (let i = -1; i < 5; i++) {
    const y = startYear + i;
    years.add(`${y}-${y + 1}`);
  }
  years.add(DEFAULT_ACADEMIC_YEAR);
  return Array.from(years).sort((a, b) => b.localeCompare(a));
}

function parseHaftaQuery(raw: string | null): Date | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(`${raw}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function academicYearLabelForDate(d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth();
  if (m >= 8) return `${y}-${y + 1}`;
  return `${y - 1}-${y}`;
}

type CalendarViewMode = 'week' | 'month';

function AkademikTakvimPageInner() {
  const { token, me } = useAuth();
  const searchParams = useSearchParams();
  const haftaKey = searchParams.get('hafta');
  const haftaParsed = useMemo(() => parseHaftaQuery(haftaKey), [haftaKey]);
  const calendarDefaultDate = useMemo(() => {
    const d = parseHaftaQuery(haftaKey);
    return d ?? new Date();
  }, [haftaKey]);
  const [weeks, setWeeks] = useState<WeekWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<CalendarViewMode>('week');
  const isSchoolAdmin = me?.role === 'school_admin';
  const isSuperadmin = me?.role === 'superadmin';
  const isTeacher = me?.role === 'teacher';
  const academicYears = getAcademicYears();
  const [academicYear, setAcademicYear] = useState(DEFAULT_ACADEMIC_YEAR);
  const [previewSchoolType, setPreviewSchoolType] = useState('ilkokul');
  const progress = useAcademicProgress();
  const currentWeekOrder = getCurrentWeekOrder(weeks);
  const currentWeekData = weeks.find((w) => w.weekNumber === currentWeekOrder);
  const etkinlikSayisi = (currentWeekData?.belirliGunHafta?.length ?? 0) + (currentWeekData?.ogretmenIsleri?.length ?? 0);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const st =
        isSuperadmin && previewSchoolType
          ? `&school_type=${encodeURIComponent(previewSchoolType)}`
          : '';
      const data = await apiFetch<WeekWithItems[]>(
        `/academic-calendar?academic_year=${encodeURIComponent(academicYear)}${st}`,
        { token },
      );
      setWeeks(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Yüklenemedi');
      setWeeks([]);
    } finally {
      setLoading(false);
    }
  }, [token, academicYear, isSuperadmin, previewSchoolType]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!haftaParsed) return;
    setAcademicYear(academicYearLabelForDate(haftaParsed));
  }, [haftaParsed]);

  useEffect(() => {
    if (!haftaKey || !/^\d{4}-\d{2}-\d{2}$/.test(haftaKey) || weeks.length === 0 || loading) return;
    const id = requestAnimationFrame(() => {
      document.getElementById('akademik-takvim-icerik')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => cancelAnimationFrame(id);
  }, [haftaKey, weeks.length, loading]);

  return (
    <div className="space-y-3 md:space-y-4 lg:space-y-5">
      {/* Header */}
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-3 py-3 shadow-lg md:rounded-2xl md:px-5 md:py-4 md:shadow-xl lg:py-5">
        <div className="relative z-10 flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-3">
          <div className="flex min-w-0 items-center gap-2.5 md:gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/12 backdrop-blur md:size-11 md:rounded-xl lg:size-12">
              <Calendar className="size-[1.15rem] text-white md:size-7 lg:size-8" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-base font-bold tracking-tight text-white md:text-xl lg:text-2xl">Akademik Takvim</h1>
              <p className="mt-0.5 hidden truncate text-xs text-white/75 md:block md:text-[13px] lg:text-sm">Eğitim Öğretim Yılı · {academicYear}</p>
            </div>
          </div>
          <div className="flex w-full min-w-0 flex-col gap-1.5 md:w-auto md:flex-row md:flex-wrap md:items-center md:gap-2">
            <select
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="h-9 w-full rounded-md border border-white/25 bg-white/10 px-2.5 text-xs font-medium text-white backdrop-blur focus:border-white/45 focus:outline-none focus:ring-1 focus:ring-white/25 md:h-8 md:min-h-8 md:w-auto md:rounded-lg md:px-2.5 md:text-xs md:focus:ring-2 lg:min-h-9 lg:px-3 lg:text-sm"
              aria-label="Öğretim yılı"
            >
              {academicYears.map((y) => (
                <option key={y} value={y} className="bg-slate-800 text-white">
                  {y}
                </option>
              ))}
            </select>
            {isSuperadmin && (
              <select
                value={previewSchoolType}
                onChange={(e) => setPreviewSchoolType(e.target.value)}
                className="h-9 w-full rounded-md border border-white/25 bg-white/10 px-2.5 text-xs font-medium text-white backdrop-blur md:h-8 md:min-h-8 md:w-auto md:rounded-lg md:px-2.5 md:text-xs lg:min-h-9 lg:px-3 lg:text-sm"
                aria-label="Önizleme kurum türü"
              >
                <option value="ilkokul" className="bg-slate-800 text-white">
                  İlkokul önizleme
                </option>
                <option value="__global__" className="bg-slate-800 text-white">
                  Yalnız ortak
                </option>
                <option value="anaokul" className="bg-slate-800 text-white">
                  Anaokul
                </option>
                <option value="ortaokul" className="bg-slate-800 text-white">
                  Ortaokul
                </option>
                <option value="lise" className="bg-slate-800 text-white">
                  Lise
                </option>
                <option value="meslek_lisesi" className="bg-slate-800 text-white">
                  Meslek lisesi
                </option>
                <option value="imam_hatip_ortaokul" className="bg-slate-800 text-white">
                  İHL ortaokul
                </option>
                <option value="imam_hatip_lise" className="bg-slate-800 text-white">
                  İHL lise
                </option>
                <option value="ozel_egitim" className="bg-slate-800 text-white">
                  Özel eğitim
                </option>
                <option value="halk_egitim" className="bg-slate-800 text-white">
                  Halk eğitim
                </option>
                <option value="bilsem" className="bg-slate-800 text-white">
                  BİLSEM
                </option>
              </select>
            )}
            <div className="flex h-9 w-full rounded-md border border-white/25 bg-white/10 p-px md:h-auto md:w-auto md:rounded-lg md:p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('week')}
                className={`flex flex-1 items-center justify-center gap-1 rounded-[0.35rem] px-2 text-[11px] font-medium transition-colors md:flex-none md:rounded-md md:px-3 md:text-sm ${
                  viewMode === 'week' ? 'bg-white/22 text-white' : 'text-white/72 hover:text-white'
                }`}
                aria-pressed={viewMode === 'week'}
                aria-label="Hafta görünümü"
              >
                <CalendarDays className="size-3.5 md:size-4" />
                Hafta
              </button>
              <button
                type="button"
                onClick={() => setViewMode('month')}
                className={`flex flex-1 items-center justify-center gap-1 rounded-[0.35rem] px-2 text-[11px] font-medium transition-colors md:flex-none md:rounded-md md:px-3 md:text-sm ${
                  viewMode === 'month' ? 'bg-white/22 text-white' : 'text-white/72 hover:text-white'
                }`}
                aria-pressed={viewMode === 'month'}
                aria-label="Ay görünümü"
              >
                <LayoutList className="size-3.5 md:size-4" />
                Ay
              </button>
            </div>
            {isSuperadmin && (
              <Button variant="secondary" size="sm" asChild className="border-white/20 bg-white/10 text-white hover:bg-white/20">
                <Link href="/akademik-takvim-sablonu">
                  <LayoutGrid className="mr-2 size-4" aria-hidden />
                  Şablon Düzenle
                </Link>
              </Button>
            )}
            {isSchoolAdmin && (
              <Button variant="secondary" size="sm" asChild className="border-white/20 bg-white/10 text-white hover:bg-white/20">
                <Link href="/akademik-takvim-ayarlar">
                  <Settings className="mr-2 size-4" aria-hidden />
                  Ayarlar
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      <DurationTableMobile elapsed={progress.elapsed} remaining={progress.remaining} />

      {/* Özet kartları — md+ */}
      <div className="hidden w-full grid-cols-2 gap-3 md:grid md:gap-3 lg:gap-4">
        <TimeCard
          icon={Clock}
          title="Geçen süre"
          values={progress.elapsed}
          className="border-0 bg-gradient-to-br from-zinc-50 via-white to-indigo-50/60 dark:from-zinc-950 dark:via-zinc-950 dark:to-indigo-950/40"
        />
        <TimeCard
          icon={Sun}
          title="Kalan süre"
          values={progress.remaining}
          className="border-0 bg-gradient-to-br from-teal-50/90 via-cyan-50/40 to-white dark:from-teal-950/30 dark:via-cyan-950/20 dark:to-zinc-950"
        />
      </div>

      {/* İlerleme çubuğu */}
      <Card className="w-full border-zinc-200/70 bg-gradient-to-b from-white to-zinc-50/70 shadow-sm dark:border-zinc-800 dark:from-zinc-950 dark:to-zinc-900/80 md:mx-auto md:max-w-none">
        <CardContent className="px-2.5 py-2 md:px-4 md:py-3">
          <div className="mb-1 flex items-center gap-1.5 md:mb-2">
            <BarChart3 className="size-3 shrink-0 text-indigo-500 md:size-3.5 md:text-muted-foreground" aria-hidden />
            <span className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400 md:text-xs md:text-foreground">Yıl ilerlemesi</span>
          </div>
          <div className="flex h-4 overflow-hidden rounded-full bg-zinc-200/80 dark:bg-zinc-800 md:h-5 lg:h-6">
            <div
              className="flex min-w-0 items-center justify-center bg-gradient-to-r from-indigo-600 to-violet-500 px-1 transition-all sm:text-xs"
              style={{ width: `${progress.elapsedPct}%` }}
            >
              {progress.elapsedPct >= 15 && (
                <span className="hidden truncate font-medium text-white md:inline">Geçen %{progress.elapsedPct.toFixed(1)}</span>
              )}
            </div>
            <div className="flex min-w-0 flex-1 items-center justify-center bg-gradient-to-r from-teal-500 to-cyan-500 px-1 md:text-xs">
              <span className="hidden truncate font-medium text-white md:inline">Kalan %{(100 - progress.elapsedPct).toFixed(1)}</span>
            </div>
          </div>
          <p className="mt-1.5 flex justify-between gap-2 text-[9px] text-zinc-500 dark:text-zinc-400 md:hidden">
            <span>Geçen %{progress.elapsedPct.toFixed(1)}</span>
            <span>Kalan %{(100 - progress.elapsedPct).toFixed(1)}</span>
          </p>
        </CardContent>
      </Card>

      {/* Şu an bu hafta */}
      {currentWeekOrder > 0 && (
        <Card className="w-full border-indigo-200/45 bg-gradient-to-br from-indigo-50/70 to-white shadow-sm dark:border-indigo-900/40 dark:from-indigo-950/35 dark:to-zinc-950 md:border-primary/30 md:bg-primary/5 md:shadow-none">
          <CardContent className="px-2.5 py-2 md:px-4 md:py-2.5">
            <div className="flex flex-col items-center gap-1.5 text-center sm:flex-row sm:flex-wrap sm:items-center sm:gap-2 sm:text-left md:gap-2">
              <div className="flex items-center justify-center gap-1.5 sm:justify-start">
                <Pin className="size-4 text-primary" aria-hidden />
                <a href="#akademik-takvim-icerik" className="text-sm font-semibold text-foreground underline-offset-4 hover:underline md:text-sm">
                  Şu an bu haftadasınız
                </a>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-1.5 sm:justify-start md:gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary md:px-2.5 md:py-1 md:text-sm">
                  <Calendar className="size-3 md:size-3.5" aria-hidden />
                  {currentWeekOrder}. Hafta
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground md:px-2.5 md:py-1 md:text-sm">{progress.weekRange}</span>
                {etkinlikSayisi > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 md:px-2.5 md:py-1 md:text-sm">
                    <Star className="size-3.5" aria-hidden />
                    {etkinlikSayisi} etkinlik
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Takvim görünümü – hafta (varsayılan) / ay (opsiyonel) */}
      <div id="akademik-takvim-icerik">
        <div className="mb-2 md:mb-3">
          <h2 className="text-base font-semibold tracking-tight md:text-base lg:text-lg">Hafta ve özet</h2>
          <TakvimSayfaBilgi isTeacher={isTeacher} showStaffNote={isSchoolAdmin || isSuperadmin} />
        </div>

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
            description={`${academicYear} öğretim yılı için çalışma takvimi henüz yüklenmemiş. Farklı yıl seçmeyi deneyin veya okul yöneticisi ile iletişime geçin.`}
          />
        )}
        {!loading && !error && weeks.length > 0 && (
          <AcademicCalendarView
            weeks={weeks}
            view={viewMode}
            onViewChange={(v) => setViewMode(v)}
            defaultDate={calendarDefaultDate}
            currentUserId={me?.id}
            compact={isTeacher}
          />
        )}
      </div>
    </div>
  );
}

export default function AkademikTakvimPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-24">
          <LoadingSpinner />
        </div>
      }
    >
      <AkademikTakvimPageInner />
    </Suspense>
  );
}
