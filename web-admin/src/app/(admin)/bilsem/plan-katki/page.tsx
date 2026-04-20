'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { PlanKatkiStatusBadge } from '@/components/bilsem/plan-katki-status-badge';
import { Plus, FileStack, RefreshCw, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';

export type BilsemPlanSubmissionListItem = {
  id: string;
  status: string;
  subjectCode: string;
  subjectLabel: string;
  anaGrup: string;
  altGrup: string | null;
  academicYear: string;
  planGrade: number;
  weekCount: number;
  submittedAt: string | null;
  updatedAt: string;
  createdAt: string;
};

type FilterKey = 'all' | 'draft' | 'pending_review' | 'published' | 'rejected' | 'withdrawn';

const FILTERS: { key: FilterKey; label: string }[] = [
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

export default function BilsemPlanKatkiListPage() {
  const { token, me } = useAuth();
  const [rows, setRows] = useState<BilsemPlanSubmissionListItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null);
    try {
      const data = await apiFetch<BilsemPlanSubmissionListItem[]>('/bilsem/plan-submissions/author/me', { token });
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

  if (!me || (me.role !== 'teacher' && me.role !== 'school_admin')) {
    return null;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-3 py-4 sm:px-4">
      <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 dark:border-violet-500/25 dark:bg-violet-500/10">
        <p className="text-sm font-medium text-foreground">Akış</p>
        <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-muted-foreground">
          <li>Taslak oluşturun (JSON haftalar).</li>
          <li>Kaydedip «İncelemeye gönder» deyin.</li>
          <li>Moderasyon onayından sonra içerik yıllık plan kataloğuna yazılır.</li>
          <li>
            <Link href="/bilsem/yillik-plan" className="font-medium text-violet-600 underline-offset-2 hover:underline dark:text-violet-400">
              Bilsem yıllık plan (Word)
            </Link>{' '}
            ile üretim yapıldığında, tek kaynaklı onaylı içeriklerde katkı sahibine jeton yazılır.
          </li>
        </ol>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">Plan katkılarım</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gönderimlerinizi buradan yönetin. Kuyrukta beklerken düzenlemek için geri çekebilirsiniz.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void load()} disabled={rows === null}>
            <RefreshCw className={cn('h-3.5 w-3.5', rows === null && 'animate-spin')} />
            Yenile
          </Button>
          <Button asChild className="gap-2">
            <Link href="/bilsem/plan-katki/yeni">
              <Plus className="h-4 w-4" />
              Yeni taslak
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" aria-hidden />
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              filter === f.key
                ? 'border-violet-500/40 bg-violet-500/15 text-violet-900 dark:text-violet-100'
                : 'border-transparent bg-muted/60 text-muted-foreground hover:bg-muted',
            )}
          >
            {f.label}
            {rows ? ` (${f.key === 'all' ? rows.length : rows.filter((r) => r.status === f.key).length})` : ''}
          </button>
        ))}
      </div>

      {err && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {err}
        </div>
      )}

      {rows === null ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner label="Yükleniyor…" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
          <FileStack className="mx-auto mb-3 h-10 w-10 opacity-40" />
          {rows.length === 0 ? 'Henüz gönderim yok. «Yeni taslak» ile başlayın.' : 'Bu filtrede kayıt yok.'}
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {filtered.map((r) => (
            <li key={r.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <PlanKatkiStatusBadge status={r.status} />
                  <span className="text-xs text-muted-foreground">{r.weekCount} hafta</span>
                </div>
                <p className="truncate font-medium text-foreground">
                  {r.subjectLabel}{' '}
                  <span className="font-normal text-muted-foreground">({r.subjectCode})</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {r.anaGrup}
                  {r.altGrup ? ` · ${r.altGrup}` : ''} · {r.academicYear} · plan sınıfı {r.planGrade}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Güncelleme: {fmtShort(r.updatedAt)}
                  {r.submittedAt ? ` · Gönderim: ${fmtShort(r.submittedAt)}` : ''}
                </p>
              </div>
              <Button variant="outline" size="sm" asChild className="shrink-0 self-start sm:self-center">
                <Link href={`/bilsem/plan-katki/${r.id}`}>Detay</Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
