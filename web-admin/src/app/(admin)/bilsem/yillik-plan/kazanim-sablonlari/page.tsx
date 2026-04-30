'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { ChevronRight, ExternalLink, Filter, Layers, Sparkles, Target } from 'lucide-react';

type BilsemPlanSummary = {
  subject_code: string;
  subject_label: string;
  academic_year: string;
  ana_grup: string | null;
  alt_grup: string | null;
  week_count: number;
};

export default function BilsemKazanimSablonlariPage() {
  const router = useRouter();
  const { token, me } = useAuth();
  const [items, setItems] = useState<BilsemPlanSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSubject, setFilterSubject] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterAnaGrup, setFilterAnaGrup] = useState('');

  const canAccess =
    me?.role === 'teacher' ||
    me?.role === 'school_admin' ||
    me?.role === 'superadmin';

  const fetchPlans = useCallback(async () => {
    if (!token || !canAccess) return;
    setLoading(true);
    try {
      const res = await apiFetch<{ items?: BilsemPlanSummary[] }>('/bilsem/yillik-plan/plan-summaries', { token });
      const onlyBilsem = (res.items ?? []).filter((x) => String(x.ana_grup ?? '').trim());
      setItems(onlyBilsem);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [token, canAccess]);

  useEffect(() => {
    if (me && !canAccess) router.replace('/403');
  }, [me, canAccess, router]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const subjectOptions = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach((s) => {
      if (s.subject_code && s.subject_label) map.set(s.subject_code, s.subject_label);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1], 'tr'));
  }, [items]);

  const yearOptions = useMemo(() => {
    const set = new Set<string>();
    items.forEach((s) => {
      if (s.academic_year) set.add(s.academic_year);
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a, 'tr'));
  }, [items]);

  const anaGrupOptions = useMemo(() => {
    const set = new Set<string>();
    items.forEach((s) => {
      const g = String(s.ana_grup ?? '').trim();
      if (g) set.add(g);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'tr'));
  }, [items]);

  const filtered = useMemo(
    () =>
      [...items].sort((a, b) => {
        const y = String(b.academic_year ?? '').localeCompare(String(a.academic_year ?? ''));
        if (y !== 0) return y;
        const g = String(a.ana_grup ?? '').localeCompare(String(b.ana_grup ?? ''));
        if (g !== 0) return g;
        return String(a.subject_label ?? '').localeCompare(String(b.subject_label ?? ''));
      }).filter((x) => {
        if (filterSubject && x.subject_code !== filterSubject) return false;
        if (filterYear && x.academic_year !== filterYear) return false;
        if (filterAnaGrup && String(x.ana_grup ?? '') !== filterAnaGrup) return false;
        return true;
      }),
    [items, filterSubject, filterYear, filterAnaGrup],
  );

  const palette = useMemo(
    () => [
      {
        wrap: 'from-violet-500/15 via-fuchsia-500/10 to-transparent',
        chip: 'bg-violet-500/15 text-violet-700 dark:text-violet-200',
        ring: 'hover:border-violet-400/60',
      },
      {
        wrap: 'from-cyan-500/15 via-sky-500/10 to-transparent',
        chip: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-200',
        ring: 'hover:border-cyan-400/60',
      },
      {
        wrap: 'from-emerald-500/15 via-teal-500/10 to-transparent',
        chip: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-200',
        ring: 'hover:border-emerald-400/60',
      },
      {
        wrap: 'from-amber-500/15 via-orange-500/10 to-transparent',
        chip: 'bg-amber-500/15 text-amber-700 dark:text-amber-200',
        ring: 'hover:border-amber-400/60',
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-linear-to-r from-primary/10 via-cyan-500/10 to-violet-500/10 p-1.5">
        <Link
          href="/bilsem/yillik-plan"
          className="rounded-lg bg-background/80 px-3 py-1.5 text-xs font-semibold text-foreground ring-1 ring-border/60 transition hover:bg-background sm:text-sm"
        >
          Word plan
        </Link>
        <span className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm sm:text-sm">
          Kazanim setleri
        </span>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
        <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-violet-500/10 via-transparent to-cyan-500/10" />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground sm:text-2xl">Bilsem Kazanım Görünümü</h1>
            <p className="text-xs text-muted-foreground sm:text-sm">Bilsem yıllık plan satırlarını haftalara göre görüntüleyin.</p>
          </div>
          <svg viewBox="0 0 280 56" className="h-10 w-full max-w-[220px] opacity-80 sm:h-12" aria-hidden="true">
            <path d="M0 30 C50 8, 88 50, 140 26 C190 8, 228 42, 280 18" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary/50" />
            <circle cx="60" cy="22" r="3" className="fill-violet-500/70" />
            <circle cx="140" cy="26" r="3" className="fill-cyan-500/70" />
            <circle cx="225" cy="23" r="3" className="fill-emerald-500/70" />
          </svg>
          <Link
            href="/bilsem/yillik-plan"
            className="inline-flex items-center rounded-lg border border-input bg-background px-3 py-2 text-xs font-medium hover:bg-muted sm:px-4 sm:text-sm"
          >
            <ExternalLink className="mr-2 size-4" />
            Word plana dön
          </Link>
        </div>
      </div>

      <Card className="overflow-hidden border-border/70">
        <CardHeader className="border-b border-border/60 bg-linear-to-r from-amber-500/10 to-fuchsia-500/10 pb-3">
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
            <Filter className="size-4" />
            Filtrele
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2 pt-3 sm:grid-cols-3 sm:gap-3 sm:pt-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground sm:text-xs">Ders</label>
              <select
                value={filterSubject}
                onChange={(e) => setFilterSubject(e.target.value)}
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-xs ring-offset-background transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 sm:text-sm"
              >
                <option value="">Tümü</option>
                {subjectOptions.map(([code, label]) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground sm:text-xs">Öğretim Yılı</label>
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-xs ring-offset-background transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 sm:text-sm"
              >
                <option value="">Tümü</option>
                {yearOptions.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground sm:text-xs">Ana grup</label>
              <select
                value={filterAnaGrup}
                onChange={(e) => setFilterAnaGrup(e.target.value)}
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-xs ring-offset-background transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 sm:text-sm"
              >
                <option value="">Tümü</option>
                {anaGrupOptions.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="size-4" />
            Bilsem planlari ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
        {loading ? (
          <div className="flex justify-center py-10">
            <LoadingSpinner />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Target className="size-10 text-muted-foreground" />}
            title="Bilsem plani bulunamadi"
            description="Bilsem yillik plan icerigi bulunamadi."
          />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 sm:gap-3 xl:grid-cols-3">
            {filtered.map((row, idx) => {
              const c = palette[idx % palette.length];
              const key = `${row.subject_code}:${row.academic_year}:${row.ana_grup ?? ''}:${row.alt_grup ?? ''}`;
              return (
                <Link
                  key={key}
                  href={`/bilsem/yillik-plan/kazanim-sablonlari/${encodeURIComponent(key)}`}
                  className={`group relative overflow-hidden rounded-xl border border-border/80 p-2.5 transition-all sm:p-3 ${c.ring}`}
                >
                  <div className={`pointer-events-none absolute inset-0 bg-linear-to-br ${c.wrap}`} />
                  <div className="relative">
                    <div className="mb-2 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-md bg-background/90 px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-border/70">
                        ANA: {row.ana_grup || '-'}
                      </span>
                      <span className="rounded-md bg-background/90 px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-border/70">
                        ALT: {row.alt_grup || '-'}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="line-clamp-2 text-[14px] font-extrabold leading-snug text-foreground sm:text-[15px]">
                          {row.subject_label}
                        </div>
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          {row.subject_code} · {row.academic_year}
                        </div>
                      </div>
                      <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${c.chip}`}>
                        {row.week_count} hf
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-background/70 px-1.5 py-0.5 text-[10px] font-medium">
                        <Sparkles className="size-3" />
                        Bilsem
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary">
                        Aç
                        <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </div>

                    <svg viewBox="0 0 240 28" className="mt-2 h-5 w-full opacity-70" aria-hidden="true">
                      <path d="M0 18 C40 2, 70 26, 120 14 C170 2, 200 24, 240 10" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary/40" />
                    </svg>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
        </CardContent>
      </Card>
    </div>
  );
}
