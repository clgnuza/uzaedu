'use client';

import { useCallback, useEffect, useState } from 'react';
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
  Settings,
  LayoutGrid,
  Clock,
  Sun,
  BarChart3,
  Pin,
  Star,
  CalendarDays,
  LayoutList,
} from 'lucide-react';

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
            <div key={l} className="flex flex-col items-center rounded-lg border bg-muted/30 px-3 py-2">
              <span className="text-xl font-bold tabular-nums">{v}</span>
              <span className="text-xs text-muted-foreground">{l}</span>
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

type CalendarViewMode = 'week' | 'month';

export default function AkademikTakvimPage() {
  const { token, me } = useAuth();
  const [weeks, setWeeks] = useState<WeekWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<CalendarViewMode>('week');
  const isSchoolAdmin = me?.role === 'school_admin';
  const isSuperadmin = me?.role === 'superadmin';
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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 px-6 py-8 shadow-xl">
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex size-14 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
              <Calendar className="size-8 text-white" aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Akademik Takvim</h1>
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
                className="rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-sm font-medium text-white backdrop-blur focus:border-white/50 focus:outline-none focus:ring-2 focus:ring-white/20"
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
            <div className="flex rounded-lg border border-white/30 bg-white/10 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('week')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  viewMode === 'week' ? 'bg-white/20 text-white' : 'text-white/70 hover:text-white'
                }`}
                aria-pressed={viewMode === 'week'}
                aria-label="Hafta görünümü"
              >
                <CalendarDays className="size-4" />
                Hafta
              </button>
              <button
                type="button"
                onClick={() => setViewMode('month')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  viewMode === 'month' ? 'bg-white/20 text-white' : 'text-white/70 hover:text-white'
                }`}
                aria-pressed={viewMode === 'month'}
                aria-label="Ay görünümü"
              >
                <LayoutList className="size-4" />
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

      {/* Özet kartları */}
      <div className="grid gap-4 sm:grid-cols-2">
        <TimeCard icon={Clock} title="Geçen süre" values={progress.elapsed} className="border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-950/30" />
        <TimeCard icon={Sun} title="Kalan süre" values={progress.remaining} className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/30" />
      </div>

      {/* İlerleme çubuğu */}
      <Card>
        <CardContent className="pt-6">
          <div className="mb-3 flex items-center gap-2">
            <BarChart3 className="size-4 text-muted-foreground" aria-hidden />
            <span className="text-sm font-medium">Eğitim Öğretim Yılı İlerlemesi</span>
          </div>
          <div className="flex h-7 overflow-hidden rounded-full bg-muted">
            <div className="flex items-center justify-center bg-slate-600 text-xs font-medium text-white transition-all" style={{ width: `${progress.elapsedPct}%` }}>
              {progress.elapsedPct >= 15 && <span>Geçen: %{progress.elapsedPct.toFixed(1)}</span>}
            </div>
            <div className="flex flex-1 items-center justify-center bg-emerald-600 text-xs font-medium text-white">
              <span>Kalan: %{(100 - progress.elapsedPct).toFixed(1)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Şu an bu hafta */}
      {currentWeekOrder > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Pin className="size-5 text-primary" aria-hidden />
                <a href="#akademik-takvim-icerik" className="font-semibold text-foreground underline-offset-4 hover:underline">
                  Şu an bu haftadasınız
                </a>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1.5 text-sm font-medium text-primary">
                  <Calendar className="size-3.5" aria-hidden />
                  {currentWeekOrder}. Hafta
                </span>
                <span className="rounded-full bg-muted px-3 py-1.5 text-sm text-muted-foreground">{progress.weekRange}</span>
                {etkinlikSayisi > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
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
        <div className="mb-4">
          <h2 className="text-lg font-semibold tracking-tight">Hafta ve özet görünüm</h2>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted-foreground">
            <li>
              Kaydırırken üstte sabit kalan bardan <span className="font-medium text-foreground">hafta seçin</span> veya{' '}
              <span className="font-medium text-foreground">Hafta / Liste</span> görünümünü değiştirin.
            </li>
            <li>Hızlı şeritte yana kaydırarak yakın haftalara geçebilirsiniz (mobil).</li>
          </ul>
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
            defaultDate={new Date()}
            currentUserId={me?.id}
          />
        )}
      </div>
    </div>
  );
}
