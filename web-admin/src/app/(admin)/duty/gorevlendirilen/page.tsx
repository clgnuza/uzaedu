'use client';

import { useState, useEffect, useCallback } from 'react';
import { UserCog, ChevronLeft, ChevronRight, ArrowRight, CalendarDays, AlertCircle, Clock, FileText, HeartHandshake, BookOpen } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { DutyPageHeader } from '@/components/duty/duty-page-header';

type ReassignedSlot = {
  id: string;
  date: string;
  slot_name: string | null;
  area_name: string | null;
  shift?: 'morning' | 'afternoon';
  absent_type?: string | null;
  user_id: string;
  reassigned_from_user_id: string;
  user?: { display_name: string | null; email: string };
  reassignedFromUser?: { display_name: string | null; email: string };
};

type CoverageAssignment = {
  id: string;
  duty_slot_id: string;
  lesson_num: number;
  date: string;
  area_name: string | null;
  shift?: 'morning' | 'afternoon';
  absent_type?: string | null;
  absent_teacher: { id: string; display_name: string | null; email: string } | null;
  covered_by_user: { id: string; display_name: string | null; email: string } | null;
};

const ABSENT_TYPE_CONFIG: Record<string, { label: string; className: string; Icon: React.ElementType }> = {
  gelmeyen: { label: 'Gelmeyen', className: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300', Icon: AlertCircle },
  raporlu: { label: 'Raporlu', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', Icon: FileText },
  mazeret: { label: 'Mazeretli', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300', Icon: Clock },
  izinli: { label: 'İzinli', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', Icon: HeartHandshake },
};

const STORAGE_INCLUDE_ARCHIVED = 'duty-ozet-include-archived';

function formatDate(s: string) {
  return new Date(s + 'T12:00:00').toLocaleDateString('tr-TR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function GorevlendirilenPage() {
  const { token, me } = useAuth();
  const isAdmin = me?.role === 'school_admin';
  const [slots, setSlots] = useState<ReassignedSlot[]>([]);
  const [coverages, setCoverages] = useState<CoverageAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [includeArchived, setIncludeArchived] = useState(false);

  const [dateRange, setDateRange] = useState<{ from: string; to: string }>(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const from = `${y}-${String(m + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(y, m + 1, 0).getDate();
    const to = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return { from, to };
  });

  useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_INCLUDE_ARCHIVED);
      if (v === '1') setIncludeArchived(true);
    } catch { /* ignore */ }
  }, []);

  // En son yayınlanan planın ayına git
  useEffect(() => {
    if (!token || !isAdmin) return;
    apiFetch<{ period_start: string | null; period_end: string | null; status: string; archived_at?: string | null }[]>('/duty/plans', { token })
      .then((plans) => {
        const published = Array.isArray(plans)
          ? plans.filter((p) => p.status === 'published' && p.period_start && !p.archived_at)
              .sort((a, b) => (b.period_start! > a.period_start! ? 1 : -1))
          : [];
        if (published[0]?.period_start) {
          const pStart = published[0].period_start.slice(0, 10);
          const pEnd = published[0].period_end?.slice(0, 10) ?? pStart;
          setDateRange({ from: pStart, to: pEnd });
        }
      })
      .catch(() => {/* ignore */});
  }, [token, isAdmin]);

  const fetchData = useCallback(async () => {
    if (!token || !isAdmin) return;
    setLoading(true);
    try {
      const arch = includeArchived ? '&include_archived=1' : '';
      const [slotsRes, coveragesRes] = await Promise.all([
        apiFetch<ReassignedSlot[]>(`/duty/reassigned?from=${dateRange.from}&to=${dateRange.to}${arch}`, { token }),
        apiFetch<CoverageAssignment[]>(`/duty/coverages?from=${dateRange.from}&to=${dateRange.to}${arch}`, { token }),
      ]);
      setSlots(Array.isArray(slotsRes) ? slotsRes : []);
      setCoverages(Array.isArray(coveragesRes) ? coveragesRes : []);
    } catch {
      setSlots([]);
      setCoverages([]);
    } finally {
      setLoading(false);
    }
  }, [token, isAdmin, dateRange.from, dateRange.to, includeArchived]);

  useEffect(() => {
    if (isAdmin) fetchData();
  }, [isAdmin, fetchData]);

  const shiftMonth = (delta: number) => {
    const [y, m] = dateRange.from.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    const ny = d.getFullYear();
    const nm = d.getMonth();
    const from = `${ny}-${String(nm + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(ny, nm + 1, 0).getDate();
    const to = `${ny}-${String(nm + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    setDateRange({ from, to });
  };

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <p className="text-muted-foreground">Bu sayfaya erişim yetkiniz yok.</p>
      </div>
    );
  }

  const totalAssignments = slots.length + coverages.length;

  return (
    <div className="space-y-6">
      <DutyPageHeader
        icon={UserCog}
        title="Görevlendirmeler"
        description="Yerine görevlendirmeler ve ders saati bazlı görevlendirmeler. Tüm işlemler istatistiklere dahil edilir."
        color="purple"
        badge={
          totalAssignments > 0 ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
              {slots.length} yerine + {coverages.length} ders saati
            </span>
          ) : undefined
        }
        actions={
          <div className="flex items-center gap-2 rounded-xl bg-muted/50 p-1.5 print:hidden">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => shiftMonth(-1)} aria-label="Önceki ay">
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-[140px] text-center text-sm font-semibold text-foreground">
              {new Date(dateRange.from + 'T12:00:00').toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}
            </span>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => shiftMonth(1)} aria-label="Sonraki ay">
              <ChevronRight className="size-4" />
            </Button>
          </div>
        }
      />

      <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none print:hidden">
        <input
          type="checkbox"
          className="rounded border-border accent-primary"
          checked={includeArchived}
          onChange={(e) => {
            const on = e.target.checked;
            setIncludeArchived(on);
            try {
              localStorage.setItem(STORAGE_INCLUDE_ARCHIVED, on ? '1' : '0');
            } catch { /* ignore */ }
          }}
        />
        Arşivlenmiş planları hesaba kat
      </label>

      {/* Özet */}
      {(slots.length > 0 || coverages.length > 0) && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {slots.length > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-50 dark:bg-purple-950/20 border border-purple-200/50">
              <UserCog className="size-3.5 text-purple-500" />
              <span className="font-medium text-purple-700 dark:text-purple-300">{slots.length} yerine</span>
            </span>
          )}
          {coverages.length > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-sky-50 dark:bg-sky-950/20 border border-sky-200/50">
              <BookOpen className="size-3.5 text-sky-500" />
              <span className="font-medium text-sky-700 dark:text-sky-300">{coverages.length} ders saati</span>
            </span>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : !slots.length && !coverages.length ? (
        <EmptyState
          icon={<UserCog className="size-10 text-muted-foreground/50" />}
          title="Görevlendirme yok"
          description="Seçilen tarih aralığında yerine görevlendirme veya ders saati bazlı atama bulunamadı."
        />
      ) : (() => {
        // Günlere göre grupla: date -> { reassigns: [], coverages: [] }
        const byDate = new Map<string, { reassigns: ReassignedSlot[]; coverages: CoverageAssignment[] }>();
        for (const s of slots) {
          const d = s.date.slice(0, 10);
          if (!byDate.has(d)) byDate.set(d, { reassigns: [], coverages: [] });
          byDate.get(d)!.reassigns.push(s);
        }
        for (const c of coverages) {
          const d = c.date.slice(0, 10);
          if (!byDate.has(d)) byDate.set(d, { reassigns: [], coverages: [] });
          byDate.get(d)!.coverages.push(c);
        }
        for (const v of byDate.values()) {
          v.coverages.sort((a, b) => a.lesson_num - b.lesson_num);
        }
        const dates = Array.from(byDate.keys()).sort();

        return (
          <div className="space-y-6">
            {dates.map((dateKey) => {
              const { reassigns, coverages: dayCoverages } = byDate.get(dateKey)!;
              return (
                <section key={dateKey} className="rounded-lg border border-border/60 bg-muted/20 overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-border/60 bg-muted/40">
                    <CalendarDays className="size-4 text-muted-foreground shrink-0" />
                    <span className="font-semibold text-foreground">{formatDate(dateKey)}</span>
                    <span className="text-xs text-muted-foreground">
                      · {reassigns.length} yerine + {dayCoverages.length} ders saati
                    </span>
                  </div>
                  <div className="p-3">
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {reassigns.map((slot) => {
                        const absentCfg = ABSENT_TYPE_CONFIG[slot.absent_type ?? 'gelmeyen'] ?? ABSENT_TYPE_CONFIG.gelmeyen;
                        return (
                          <div
                            key={slot.id}
                            className="rounded-lg border border-l-2 border-l-purple-400 bg-card px-3 py-2 text-xs hover:bg-muted/30 transition-colors"
                          >
                            <div className="flex items-center gap-1.5 mb-1 text-muted-foreground">
                              <UserCog className="size-3 shrink-0 text-purple-500" />
                              {slot.area_name && <span className="truncate">{slot.area_name}</span>}
                            </div>
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="text-rose-600 dark:text-rose-400 truncate">
                                {slot.reassignedFromUser?.display_name || slot.reassignedFromUser?.email || '—'}
                              </span>
                              <ArrowRight className="size-3 shrink-0 text-purple-500" />
                              <span className="font-semibold text-purple-600 dark:text-purple-400 truncate">
                                {slot.user?.display_name || slot.user?.email || '—'}
                              </span>
                            </div>
                            <span className={cn('inline-flex mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium', absentCfg.className)}>
                              {absentCfg.label}
                            </span>
                          </div>
                        );
                      })}
                      {dayCoverages.map((cov) => {
                        const absentCfg = ABSENT_TYPE_CONFIG[cov.absent_type ?? 'gelmeyen'] ?? ABSENT_TYPE_CONFIG.gelmeyen;
                        return (
                          <div
                            key={cov.id}
                            className="rounded-lg border border-l-2 border-l-sky-400 bg-card px-3 py-2 text-xs hover:bg-muted/30 transition-colors"
                          >
                            <div className="flex items-center gap-1.5 mb-1 text-muted-foreground">
                              <BookOpen className="size-3 shrink-0 text-sky-500" />
                              <span className="shrink-0 px-1 rounded bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 font-semibold">
                                {cov.lesson_num}. ders
                              </span>
                              {cov.area_name && <span className="truncate">· {cov.area_name}</span>}
                            </div>
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="text-rose-600 dark:text-rose-400 truncate">
                                {cov.absent_teacher?.display_name || cov.absent_teacher?.email || '—'}
                              </span>
                              <ArrowRight className="size-3 shrink-0 text-sky-500" />
                              <span className="font-semibold text-sky-600 dark:text-sky-400 truncate">
                                {cov.covered_by_user?.display_name || cov.covered_by_user?.email || '—'}
                              </span>
                            </div>
                            <span className={cn('inline-flex mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium', absentCfg.className)}>
                              {absentCfg.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}
