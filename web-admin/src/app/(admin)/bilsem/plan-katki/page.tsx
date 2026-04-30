'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { PlanKatkiStatusBadge } from '@/components/bilsem/plan-katki-status-badge';
import { Alert } from '@/components/ui/alert';
import { ChevronRight, FileStack, Plus, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

export type BilsemPlanSubmissionListItem = {
  id: string;
  status: string;
  subjectCode: string;
  subjectLabel: string;
  anaGrup: string;
  altGrup: string | null;
  academicYear: string;
  planGrade: number | null;
  weekCount: number;
  submittedAt: string | null;
  decidedAt: string | null;
  publishedAt: string | null;
  rewardJetonPerGeneration: string | null;
  updatedAt: string;
  createdAt: string;
};

type AuthorSummary = {
  counts: {
    draft: number;
    pending_review: number;
    published: number;
    rejected: number;
    withdrawn: number;
  };
  planWordUsageCount: number;
  totalJetonCredited: string;
  bySubmission: { submissionId: string; usageCount: number; totalJeton: string }[];
};

type FilterKey = 'all' | 'draft' | 'pending_review' | 'published' | 'rejected' | 'withdrawn';

const FILTER_TABS: {
  key: FilterKey;
  label: string;
  short: string;
  activeClass: string;
}[] = [
  {
    key: 'all',
    label: 'Tümü',
    short: 'Tümü',
    activeClass:
      'border-violet-500/50 bg-violet-500/10 text-violet-900 dark:text-violet-200',
  },
  {
    key: 'draft',
    label: 'Taslak',
    short: 'Taslak',
    activeClass: 'border-slate-500/50 bg-slate-500/10 text-slate-800 dark:text-slate-200',
  },
  {
    key: 'pending_review',
    label: 'İncelemede',
    short: 'Kuyruk',
    activeClass: 'border-amber-500/50 bg-amber-500/10 text-amber-950 dark:text-amber-200',
  },
  {
    key: 'published',
    label: 'Yayında',
    short: 'Yayın',
    activeClass: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200',
  },
  {
    key: 'rejected',
    label: 'Red',
    short: 'Red',
    activeClass: 'border-rose-500/50 bg-rose-500/10 text-rose-900 dark:text-rose-200',
  },
  {
    key: 'withdrawn',
    label: 'Geri çekilen',
    short: 'Geri',
    activeClass: 'border-zinc-500/50 bg-zinc-500/10 text-zinc-800 dark:text-zinc-200',
  },
];

/** Satır: soldaki renk şeridi = gönderi durumu */
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

export default function BilsemPlanKatkiListPage() {
  const { token, me } = useAuth();
  const [rows, setRows] = useState<BilsemPlanSubmissionListItem[] | null>(null);
  const [summary, setSummary] = useState<AuthorSummary | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null);
    try {
      const [data, sum] = await Promise.all([
        apiFetch<BilsemPlanSubmissionListItem[]>('/bilsem/plan-submissions/author/me', { token }),
        apiFetch<AuthorSummary>('/bilsem/plan-submissions/author/summary', { token }).catch(() => null),
      ]);
      setRows(data);
      setSummary(sum);
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

  if (!me || (me.role !== 'teacher' && me.role !== 'school_admin')) {
    return null;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-3 px-3 pb-8 pt-1 sm:px-4">
      <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2">
        <h1 className="text-sm font-semibold tracking-tight sm:text-base">Bilsem plan katkılarım</h1>
        <div className="flex shrink-0 items-center gap-1">
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
          <Button asChild size="sm" className="h-8 gap-1 px-2.5 text-xs">
            <Link href="/bilsem/plan-katki/yeni">
              <Plus className="h-3.5 w-3.5" />
              Yeni gönderi
            </Link>
          </Button>
        </div>
      </div>

      <Alert variant="info" className="py-2.5 px-3 text-foreground">
        <div>
          <p className="text-xs font-medium sm:text-sm">Kısaca</p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground sm:text-xs">
            Excel ile haftaları doldurun, incelemeye gönderin. Onaylanınca kataloga girer; başka öğretmenler plan
            üretirken size jeton yazılır. Kuyruktayken gönderimi geri çekebilirsiniz.{' '}
            <Link href="/bilsem/yillik-plan" className="font-medium text-foreground underline-offset-2 hover:underline">
              Yıllık plan sihirbazı
            </Link>
          </p>
        </div>
      </Alert>

      {summary && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-medium text-muted-foreground sm:text-xs">Durum özeti</p>
          <div className="flex flex-wrap gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-md border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-medium text-sky-900 dark:text-sky-200 sm:text-xs">
              Word {summary.planWordUsageCount}
            </span>
            <span className="inline-flex items-center gap-1 rounded-md border border-violet-500/30 bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-medium text-violet-900 dark:text-violet-200 sm:text-xs">
              Jeton{' '}
              {Number.parseFloat(summary.totalJetonCredited || '0').toLocaleString('tr-TR', { maximumFractionDigits: 2 })}
            </span>
            <span className="inline-flex items-center rounded-md border border-slate-500/30 bg-slate-500/10 px-1.5 py-0.5 text-[10px] text-slate-800 dark:text-slate-200 sm:text-xs">
              Taslak {summary.counts.draft}
            </span>
            <span className="inline-flex items-center rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-950 dark:text-amber-200 sm:text-xs">
              Kuyruk {summary.counts.pending_review}
            </span>
            <span className="inline-flex items-center rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-900 dark:text-emerald-200 sm:text-xs">
              Yayın {summary.counts.published}
            </span>
            {summary.counts.rejected > 0 && (
              <span className="inline-flex items-center rounded-md border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-[10px] text-rose-900 dark:text-rose-200 sm:text-xs">
                Red {summary.counts.rejected}
              </span>
            )}
            {summary.counts.withdrawn > 0 && (
              <span className="inline-flex items-center rounded-md border border-zinc-500/30 bg-zinc-500/10 px-1.5 py-0.5 text-[10px] text-zinc-800 dark:text-zinc-200 sm:text-xs">
                Geri {summary.counts.withdrawn}
              </span>
            )}
          </div>
        </div>
      )}

      <div
        className="flex flex-wrap gap-1"
        role="tablist"
        aria-label="Durum filtreleri"
      >
        {FILTER_TABS.map((f) => {
          const count =
            f.key === 'all'
              ? (rows?.length ?? 0)
              : rows
                ? rows.filter((r) => r.status === f.key).length
                : 0;
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
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
          {err}
        </div>
      )}

      {rows === null ? (
        <div className="flex justify-center py-10">
          <LoadingSpinner label="Yükleniyor…" />
        </div>
      ) : filtered.length === 0 ? (
        <div
          className={cn(
            'rounded-lg border border-dashed py-6 text-center',
            rows.length === 0
              ? 'border-violet-400/40 bg-violet-500/4'
              : 'border-amber-400/40 bg-amber-500/4',
          )}
        >
          <FileStack
            className={cn('mx-auto mb-1.5 h-6 w-6', rows.length === 0 ? 'text-violet-500/60' : 'text-amber-600/60')}
          />
          <p className="px-2 text-xs text-muted-foreground">
            {rows.length === 0
              ? 'Henüz gönderi yok. Yeni gönderi ile Excel yükleyerek başlayın.'
              : 'Bu filtrede kayıt yok. Soldaki renkli sekmelerden “Tümü” veya başka durum seçin.'}
          </p>
        </div>
      ) : (
        <ul className="space-y-1.5" aria-label="Gönderi listesi">
          {filtered.map((r) => {
            const { bar, rowBg } = statusRowClass(r.status);
            return (
              <li key={r.id} className="overflow-hidden rounded-lg border border-border/80 bg-card shadow-sm">
                <Link
                  href={`/bilsem/plan-katki/${r.id}`}
                  className={cn(
                    'group flex min-w-0 items-stretch border-l-4 pl-2.5 pr-1.5 transition-colors sm:pl-3',
                    bar,
                    rowBg,
                    'hover:bg-white/50 dark:hover:bg-white/5',
                  )}
                >
                  <div className="min-w-0 flex-1 py-2.5 pr-1">
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <div className="min-w-0">
                        <PlanKatkiStatusBadge status={r.status} />
                        <p className="mt-1.5 truncate text-sm font-semibold leading-tight sm:text-base">
                          {r.subjectLabel}
                        </p>
                        <p className="text-[10px] text-muted-foreground sm:text-xs">
                          {r.anaGrup}
                          {r.altGrup ? ` · ${r.altGrup}` : ''}
                        </p>
                      </div>
                      <span className="shrink-0 rounded bg-background/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground tabular-nums ring-1 ring-border/50 sm:text-xs">
                        {r.weekCount} hafta
                      </span>
                    </div>
                    <p className="mt-1.5 line-clamp-1 text-[10px] text-muted-foreground/90 sm:text-xs">
                      <span className="text-foreground/80">{r.academicYear}</span>
                      {r.status === 'published' && r.publishedAt && (
                        <span> · yayın {fmtShort(r.publishedAt)}</span>
                      )}
                      {r.status === 'rejected' && r.decidedAt && <span> · red {fmtShort(r.decidedAt)}</span>}
                      {r.status === 'pending_review' && r.submittedAt && (
                        <span> · gönderim {fmtShort(r.submittedAt)}</span>
                      )}
                      {` · güncelleme ${fmtShort(r.updatedAt)}`}
                      {r.status === 'published' && r.rewardJetonPerGeneration
                        ? ` · ${r.rewardJetonPerGeneration} jtn/üretim`
                        : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center pl-0.5">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition group-hover:bg-background/80 group-hover:text-foreground">
                      <ChevronRight className="h-4 w-4" />
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
