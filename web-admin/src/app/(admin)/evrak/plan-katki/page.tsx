'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Alert } from '@/components/ui/alert';
import { ChevronRight, FileStack, Plus, RefreshCw } from 'lucide-react';
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

const FILTER_TABS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'Tümü' },
  { key: 'draft', label: 'Taslak' },
  { key: 'pending_review', label: 'İncelemede' },
  { key: 'published', label: 'Yayında' },
  { key: 'rejected', label: 'Red' },
  { key: 'withdrawn', label: 'Geri çekilen' },
];

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

  if (!me || (me.role !== 'teacher' && me.role !== 'school_admin')) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-3 px-3 pb-8 pt-1 sm:px-4">
      <div className="relative overflow-hidden rounded-2xl border border-violet-200/60 bg-gradient-to-br from-violet-100/70 via-white to-cyan-100/40 p-3 shadow-sm dark:border-violet-800/30 dark:from-violet-950/30 dark:via-zinc-950 dark:to-cyan-950/20">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40 dark:opacity-20"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140' viewBox='0 0 140 140'%3E%3Cg fill='none' stroke='%238b5cf6' stroke-opacity='0.18'%3E%3Cpath d='M0 70h140M70 0v140'/%3E%3Ccircle cx='70' cy='70' r='22'/%3E%3C/g%3E%3C/svg%3E\")",
          }}
        />
        <div className="relative flex items-center justify-between gap-2">
          <h1 className="text-sm font-semibold tracking-tight sm:text-base">Evrak plan katkılarım</h1>
          <div className="text-[10px] text-violet-700/80 dark:text-violet-300/80 sm:text-xs">Pastel moderasyon akışı</div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => void load()} disabled={rows === null}>
            <RefreshCw className={cn('h-3.5 w-3.5', rows === null && 'animate-spin')} />
          </Button>
          <Button asChild size="sm" className="h-8 gap-1 px-2.5 text-xs">
            <Link href="/evrak/plan-katki/yeni">
              <Plus className="h-3.5 w-3.5" />
              Yeni gönderi
            </Link>
          </Button>
        </div>
      </div>

      <Alert variant="info" className="py-2.5 px-3 text-foreground">
        <p className="text-[11px] leading-snug text-muted-foreground sm:text-xs">
          Öğretmen planı Excel ile yükler, moderasyona gönderir; onay sonrası yıllık plan içeriği yayımlanır.
        </p>
      </Alert>

      <div className="flex flex-wrap gap-1">
        {FILTER_TABS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              'rounded-md border px-2 py-0.5 text-[10px] font-medium sm:text-xs',
              filter === f.key ? 'border-violet-500/50 bg-violet-500/10 text-violet-900 dark:text-violet-200' : 'border-transparent bg-muted/50 text-muted-foreground',
            )}
          >
            {f.label} {f.key === 'all' ? (rows?.length ?? 0) : (rows?.filter((r) => r.status === f.key).length ?? 0)}
          </button>
        ))}
      </div>

      {err && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">{err}</div>}

      {rows === null ? (
        <div className="flex justify-center py-10"><LoadingSpinner label="Yükleniyor…" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed py-6 text-center">
          <FileStack className="mx-auto mb-1.5 h-6 w-6 text-violet-500/60" />
          <p className="px-2 text-xs text-muted-foreground">Kayıt yok.</p>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {filtered.map((r) => (
            <li key={r.id} className="overflow-hidden rounded-xl border border-violet-200/40 bg-gradient-to-r from-violet-50/70 to-white shadow-sm dark:border-violet-800/30 dark:from-violet-950/20 dark:to-zinc-950">
              <Link href={`/evrak/plan-katki/${r.id}`} className="group flex min-w-0 items-stretch border-l-4 border-l-violet-500/50 pl-2.5 pr-1.5 transition hover:bg-violet-500/[0.05]">
                <div className="min-w-0 flex-1 py-2.5 pr-1">
                  <p className="truncate text-sm font-semibold sm:text-base">{r.subjectLabel}</p>
                  <p className="text-[10px] text-muted-foreground sm:text-xs">
                    {r.grade}. sınıf{r.section ? ` · ${r.section}` : ''} · {r.academicYear} · {weekCount(r.itemsJson)} hafta · güncelleme {fmtShort(r.updatedAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center pl-0.5">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground">
                    <ChevronRight className="h-4 w-4" />
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
