'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { PlanKatkiStatusBadge } from '@/components/bilsem/plan-katki-status-badge';
import {
  CalendarRange,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  FileStack,
  Layers,
  Plus,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Row = {
  id: string;
  status: string;
  subjectCode: string;
  subjectLabel: string;
  grade: number;
  section: string | null;
  academicYear: string;
  itemsJson: string;
  submittedAt: string | null;
  decidedAt: string | null;
  publishedAt: string | null;
  updatedAt: string;
  createdAt: string;
};

type FilterKey = 'all' | 'draft' | 'pending_review' | 'published' | 'rejected' | 'withdrawn';

const FILTER_TABS: {
  key: FilterKey;
  label: string;
  short: string;
  activeClass: string;
}[] = [
  { key: 'all', label: 'Tümü', short: 'Tümü', activeClass: 'border-violet-500/50 bg-violet-500/10 text-violet-900 dark:text-violet-200' },
  { key: 'draft', label: 'Taslak', short: 'Taslak', activeClass: 'border-slate-500/50 bg-slate-500/10 text-slate-800 dark:text-slate-200' },
  { key: 'pending_review', label: 'İncelemede', short: 'Kuyruk', activeClass: 'border-amber-500/50 bg-amber-500/10 text-amber-950 dark:text-amber-200' },
  { key: 'published', label: 'Yayında', short: 'Yayın', activeClass: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200' },
  { key: 'rejected', label: 'Red', short: 'Red', activeClass: 'border-rose-500/50 bg-rose-500/10 text-rose-900 dark:text-rose-200' },
  { key: 'withdrawn', label: 'Geri çekilen', short: 'Geri', activeClass: 'border-zinc-500/50 bg-zinc-500/10 text-zinc-800 dark:text-zinc-200' },
];

const STATUS_ROW: Record<string, { bar: string; rowBg: string }> = {
  draft: { bar: 'border-l-slate-400', rowBg: 'bg-slate-500/4' },
  pending_review: { bar: 'border-l-amber-500', rowBg: 'bg-amber-500/4' },
  published: { bar: 'border-l-emerald-500', rowBg: 'bg-emerald-500/4' },
  rejected: { bar: 'border-l-rose-500', rowBg: 'bg-rose-500/4' },
  withdrawn: { bar: 'border-l-zinc-400', rowBg: 'bg-zinc-500/4 dark:bg-zinc-500/6' },
};

function statusRowClass(status: string) {
  return STATUS_ROW[status] ?? { bar: 'border-l-border', rowBg: 'bg-muted/30' };
}

function fmtShort(iso: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function weekCount(itemsJson: string): number {
  try {
    const j = JSON.parse(itemsJson) as unknown;
    return Array.isArray(j) ? j.length : 0;
  } catch {
    return 0;
  }
}

function countByStatus(rows: Row[] | null) {
  const c = { draft: 0, pending_review: 0, published: 0, rejected: 0, withdrawn: 0 };
  if (!rows) return c;
  for (const r of rows) {
    if (r.status in c) c[r.status as keyof typeof c] += 1;
  }
  return c;
}

export default function EvrakPlanKatkiListPage() {
  const { token, me } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null);
    try {
      const data = await apiFetch<Row[]>('/yillik-plan-icerik/submissions/author/me', { token });
      setRows(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Liste alınamadı');
      setRows([]);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    if (filter === 'all') return rows;
    return rows.filter((r) => r.status === filter);
  }, [rows, filter]);

  const counts = useMemo(() => countByStatus(rows), [rows]);
  const withContent = useMemo(() => (rows ?? []).filter((r) => weekCount(r.itemsJson) > 0).length, [rows]);

  if (!me || (me.role !== 'teacher' && me.role !== 'school_admin')) return null;

  return (
    <div className="relative mx-auto max-w-2xl space-y-2.5 px-2.5 pb-20 pt-1 sm:space-y-3 sm:px-4 sm:pb-8">
      <header className="sticky top-0 z-10 -mx-2.5 border-b border-border/50 bg-background/90 px-2.5 py-2 backdrop-blur-md sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-wide text-violet-600/90 dark:text-violet-400">Evrak</p>
            <h1 className="truncate text-sm font-semibold tracking-tight sm:text-base">Plan katkılarım</h1>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => void load()}
              disabled={rows === null}
              aria-label="Listeyi yenile"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', rows === null && 'animate-spin')} />
            </Button>
            <Button asChild size="sm" className="hidden h-8 gap-1 px-2.5 text-xs sm:inline-flex">
              <Link href="/evrak/plan-katki/yeni">
                <Plus className="h-3.5 w-3.5" />
                Yeni katkı
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
        <div className="rounded-lg border border-violet-500/25 bg-violet-500/8 px-2 py-1.5">
          <p className="text-[9px] font-medium text-muted-foreground sm:text-[10px]">Toplam</p>
          <p className="text-base font-bold tabular-nums leading-none sm:text-lg">{rows?.length ?? '—'}</p>
        </div>
        <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/8 px-2 py-1.5">
          <p className="text-[9px] font-medium text-muted-foreground sm:text-[10px]">Yayında</p>
          <p className="text-base font-bold tabular-nums leading-none text-emerald-800 dark:text-emerald-200 sm:text-lg">
            {rows ? counts.published : '—'}
          </p>
        </div>
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/8 px-2 py-1.5">
          <p className="text-[9px] font-medium text-muted-foreground sm:text-[10px]">Kuyruk</p>
          <p className="text-base font-bold tabular-nums leading-none text-amber-900 dark:text-amber-200 sm:text-lg">
            {rows ? counts.pending_review : '—'}
          </p>
        </div>
        <div className="col-span-3 rounded-lg border border-sky-500/25 bg-sky-500/8 px-2 py-1.5 sm:col-span-1">
          <p className="text-[9px] font-medium text-muted-foreground sm:text-[10px]">Plan yüklü</p>
          <p className="text-base font-bold tabular-nums leading-none text-sky-900 dark:text-sky-200 sm:text-lg">
            {rows ? withContent : '—'}
          </p>
        </div>
      </div>

      <p className="text-[10px] leading-snug text-muted-foreground sm:text-xs">
        Excel şablonunu indirip 36 haftalık planı doldurun; onay sonrası içerik kataloğa eklenir.
      </p>

      <div className="flex flex-wrap gap-1" role="tablist" aria-label="Durum filtreleri">
        {FILTER_TABS.map((f) => {
          const count = f.key === 'all' ? (rows?.length ?? 0) : counts[f.key as keyof typeof counts] ?? 0;
          const isActive = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setFilter(f.key)}
              className={cn(
                'rounded-md border px-1.5 py-0.5 text-[10px] font-medium transition-colors sm:px-2 sm:text-xs',
                isActive ? f.activeClass : 'border-transparent bg-muted/50 text-muted-foreground hover:bg-muted/80',
              )}
            >
              <span className="sm:hidden">
                {f.short} {count}
              </span>
              <span className="hidden sm:inline">
                {f.label} {count}
              </span>
            </button>
          );
        })}
      </div>

      {err && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-[11px] text-destructive sm:text-xs">
          {err}
        </div>
      )}

      {rows === null ? (
        <div className="flex justify-center py-8 sm:py-10">
          <LoadingSpinner label="Yükleniyor…" />
        </div>
      ) : filtered.length === 0 ? (
        <div
          className={cn(
            'rounded-xl border border-dashed px-3 py-5 text-center sm:py-6',
            rows.length === 0 ? 'border-violet-400/40 bg-violet-500/5' : 'border-amber-400/40 bg-amber-500/5',
          )}
        >
          <FileStack className={cn('mx-auto mb-2 h-7 w-7 sm:h-8 sm:w-8', rows.length === 0 ? 'text-violet-500/70' : 'text-amber-600/70')} />
          <p className="text-xs font-medium text-foreground sm:text-sm">
            {rows.length === 0 ? 'Henüz katkı eklenmedi' : 'Bu filtrede kayıt yok'}
          </p>
          <p className="mt-1 text-[10px] text-muted-foreground sm:text-xs">
            {rows.length === 0
              ? 'İlk yıllık plan katkınızı oluşturmak için aşağıdaki düğmeyi kullanın.'
              : 'Farklı bir durum sekmesi seçin veya tümünü görüntüleyin.'}
          </p>
          {rows.length === 0 && (
            <Button asChild size="sm" className="mt-3 h-9 gap-1.5">
              <Link href="/evrak/plan-katki/yeni">
                <Plus className="h-4 w-4" />
                Katkı ekle
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <ul className="space-y-1.5" aria-label="Katkı listesi">
          {filtered.map((r) => {
            const { bar, rowBg } = statusRowClass(r.status);
            const weeks = weekCount(r.itemsJson);
            const hasPlan = weeks > 0;
            const isPublished = r.status === 'published';

            return (
              <li key={r.id} className="overflow-hidden rounded-lg border border-border/80 bg-card shadow-sm">
                <Link
                  href={`/evrak/plan-katki/${r.id}`}
                  className={cn(
                    'group flex min-w-0 items-stretch border-l-[3px] pl-2 pr-1 transition-colors sm:border-l-4 sm:pl-2.5',
                    bar,
                    rowBg,
                    'hover:bg-white/60 dark:hover:bg-white/5',
                  )}
                >
                  <div className="min-w-0 flex-1 py-2 pr-0.5 sm:py-2.5">
                    <div className="flex min-w-0 items-start justify-between gap-1.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1">
                          <PlanKatkiStatusBadge status={r.status} compact />
                          {hasPlan ? (
                            <span className="inline-flex items-center gap-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-px text-[9px] font-medium text-emerald-800 dark:text-emerald-200 sm:text-[10px]">
                              <CheckCircle2 className="h-2.5 w-2.5 shrink-0" />
                              Plan eklendi
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-px text-[9px] font-medium text-amber-900 dark:text-amber-200 sm:text-[10px]">
                              <CircleDashed className="h-2.5 w-2.5 shrink-0" />
                              Plan bekleniyor
                            </span>
                          )}
                          {isPublished && (
                            <span className="inline-flex items-center gap-0.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-1.5 py-px text-[9px] font-medium text-violet-800 dark:text-violet-200 sm:text-[10px]">
                              <Sparkles className="h-2.5 w-2.5 shrink-0" />
                              Katalogda
                            </span>
                          )}
                        </div>
                        <p className="mt-1 truncate text-[13px] font-semibold leading-tight sm:text-sm">{r.subjectLabel}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0 text-[10px] text-muted-foreground sm:text-[11px]">
                          <span className="inline-flex items-center gap-0.5">
                            <Layers className="h-3 w-3 shrink-0 opacity-60" />
                            {r.grade}. sınıf{r.section ? ` · ${r.section}` : ''}
                          </span>
                          <span className="inline-flex items-center gap-0.5">
                            <CalendarRange className="h-3 w-3 shrink-0 opacity-60" />
                            {r.academicYear}
                          </span>
                        </p>
                      </div>
                      <span
                        className={cn(
                          'shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ring-1 sm:text-xs',
                          hasPlan
                            ? 'bg-background/80 text-foreground ring-border/60'
                            : 'bg-muted/50 text-muted-foreground ring-border/40',
                        )}
                      >
                        {hasPlan ? `${weeks} hf` : '—'}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-1 text-[9px] text-muted-foreground/90 sm:text-[10px]">
                      {r.status === 'published' && r.publishedAt && <span>Yayın {fmtShort(r.publishedAt)} · </span>}
                      {r.status === 'rejected' && r.decidedAt && <span>Red {fmtShort(r.decidedAt)} · </span>}
                      {r.status === 'pending_review' && r.submittedAt && (
                        <span>Gönderim {fmtShort(r.submittedAt)} · </span>
                      )}
                      Güncelleme {fmtShort(r.updatedAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition group-hover:bg-background/80 group-hover:text-foreground sm:h-8 sm:w-8">
                      <ChevronRight className="h-4 w-4" />
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <div className="fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))] left-1/2 z-20 w-[calc(100%-1.25rem)] max-w-2xl -translate-x-1/2 sm:hidden">
        <Button asChild className="h-11 w-full gap-2 shadow-lg shadow-violet-500/20">
          <Link href="/evrak/plan-katki/yeni">
            <Plus className="h-4 w-4" />
            Yeni katkı ekle
          </Link>
        </Button>
      </div>
    </div>
  );
}
