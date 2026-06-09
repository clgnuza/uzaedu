'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { PlanKatkiStatusBadge } from '@/components/bilsem/plan-katki-status-badge';
import { PlanKatkiExcelPlanUpload } from '@/components/bilsem/plan-katki-excel-upload';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle2, CircleAlert, CircleDashed, Clock3, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type Submission = {
  id: string;
  status: string;
  subjectCode: string;
  subjectLabel: string;
  grade: number;
  section: string | null;
  academicYear: string;
  itemsJson: string;
  reviewNote: string | null;
};

export default function EvrakPlanKatkiDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { token, me } = useAuth();
  const [row, setRow] = useState<Submission | null>(null);
  const [itemsJson, setItemsJson] = useState('');
  const [savedItemsJson, setSavedItemsJson] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const weekCount = useMemo(() => {
    try {
      const j = JSON.parse(itemsJson) as unknown;
      return Array.isArray(j) ? j.length : 0;
    } catch {
      return 0;
    }
  }, [itemsJson]);

  const hasPlanItems = weekCount > 0;
  const isDirty = itemsJson !== savedItemsJson;

  const load = useCallback(async () => {
    if (!token || !id) return;
    setLoading(true);
    try {
      const s = await apiFetch<Submission>(`/yillik-plan-icerik/submissions/${encodeURIComponent(id)}`, { token });
      setRow(s);
      setItemsJson(s.itemsJson);
      setSavedItemsJson(s.itemsJson);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveDraft() {
    if (!token || !id || !row || row.status !== 'draft') return;
    setBusy(true);
    try {
      const items = JSON.parse(itemsJson) as unknown[];
      const s = await apiFetch<Submission>(`/yillik-plan-icerik/submissions/${encodeURIComponent(id)}`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({ items }),
      });
      setRow(s);
      setItemsJson(s.itemsJson);
      setSavedItemsJson(s.itemsJson);
      toast.success('Taslak kaydedildi');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setBusy(false);
    }
  }

  async function submitReview() {
    if (!token || !id) return;
    setBusy(true);
    try {
      await apiFetch(`/yillik-plan-icerik/submissions/${encodeURIComponent(id)}/submit`, { token, method: 'POST' });
      toast.success('İncelemeye gönderildi');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gönderilemedi');
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    if (!token || !id) return;
    setBusy(true);
    try {
      await apiFetch(`/yillik-plan-icerik/submissions/${encodeURIComponent(id)}/withdraw`, { token, method: 'POST' });
      toast.success('Geri çekildi');
      router.push('/evrak/plan-katki');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'İşlem başarısız');
    } finally {
      setBusy(false);
    }
  }

  if (!me || (me.role !== 'teacher' && me.role !== 'school_admin')) return null;

  const statusMeta: Record<string, { card: string; icon: ReactNode }> = {
    draft: { card: 'border-slate-200/70 bg-slate-50/70 dark:border-slate-800/60 dark:bg-slate-950/30', icon: <Clock3 className="h-4 w-4" /> },
    pending_review: { card: 'border-amber-200/70 bg-amber-50/80 dark:border-amber-800/40 dark:bg-amber-950/30', icon: <Clock3 className="h-4 w-4" /> },
    published: { card: 'border-emerald-200/70 bg-emerald-50/80 dark:border-emerald-800/40 dark:bg-emerald-950/30', icon: <CheckCircle2 className="h-4 w-4" /> },
    rejected: { card: 'border-rose-200/70 bg-rose-50/80 dark:border-rose-800/40 dark:bg-rose-950/30', icon: <XCircle className="h-4 w-4" /> },
    withdrawn: { card: 'border-zinc-200/70 bg-zinc-50/80 dark:border-zinc-800/50 dark:bg-zinc-950/30', icon: <CircleAlert className="h-4 w-4" /> },
  };
  const meta = row ? (statusMeta[row.status] ?? statusMeta.pending_review) : null;

  return (
    <div className="mx-auto max-w-2xl space-y-2.5 px-2.5 pb-24 pt-1 sm:space-y-3 sm:px-4 sm:pb-8">
      <div className="flex items-start justify-between gap-2 border-b border-border/60 pb-2">
        <div className="min-w-0">
          {row && (
            <>
              <div className="mb-1 flex flex-wrap items-center gap-1">
                <PlanKatkiStatusBadge status={row.status} compact />
                {hasPlanItems ? (
                  <span className="inline-flex items-center gap-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-px text-[9px] font-medium text-emerald-800 dark:text-emerald-200">
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    {weekCount} hafta
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-px text-[9px] font-medium text-amber-900 dark:text-amber-200">
                    <CircleDashed className="h-2.5 w-2.5" />
                    Plan bekleniyor
                  </span>
                )}
                {isDirty && row.status === 'draft' && (
                  <span className="rounded-full bg-amber-500/15 px-1.5 py-px text-[9px] font-medium text-amber-900 dark:text-amber-200">
                    Kaydedilmedi
                  </span>
                )}
              </div>
              <h1 className="truncate text-sm font-semibold sm:text-base">{row.subjectLabel}</h1>
              <p className="text-[10px] text-muted-foreground sm:text-xs">
                {row.grade}. sınıf{row.section ? ` · ${row.section}` : ''} · {row.academicYear}
              </p>
            </>
          )}
        </div>
        <Button variant="ghost" size="sm" asChild className="h-8 shrink-0 gap-0.5 px-2 text-xs">
          <Link href="/evrak/plan-katki">
            <ArrowLeft className="h-3.5 w-3.5" />
            Liste
          </Link>
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8 sm:py-10">
          <LoadingSpinner label="Yükleniyor…" />
        </div>
      ) : !row ? (
        <p className="text-sm text-destructive">{err ?? 'Kayıt yok'}</p>
      ) : (
        <>
          {(row.reviewNote || row.status !== 'draft') && (
            <div className={cn('rounded-xl border px-2.5 py-2 sm:px-3 sm:py-2.5', meta?.card ?? '')}>
              <div className="flex items-start gap-2">
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/70 dark:bg-black/20 sm:h-7 sm:w-7">
                  {meta?.icon}
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold sm:text-xs">Moderasyon</p>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground sm:text-[11px]">
                    {row.reviewNote?.trim() || 'Henüz moderasyon notu yok.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {err && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-[11px] text-destructive">
              {err}
            </div>
          )}

          {row.status === 'draft' && (
            <>
              <PlanKatkiExcelPlanUpload
                variant="meb"
                itemsJson={itemsJson}
                onItemsJsonChange={setItemsJson}
                templateQuery={{
                  academicYear: row.academicYear,
                  subjectCode: row.subjectCode,
                  grade: row.grade,
                }}
              />
              <div className="fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))] left-1/2 z-20 flex w-[calc(100%-1.25rem)] max-w-2xl -translate-x-1/2 gap-1.5 sm:static sm:w-auto sm:translate-x-0 sm:flex-wrap">
                <Button className="h-10 flex-1 sm:flex-none" onClick={() => void saveDraft()} disabled={busy || !isDirty}>
                  Kaydet
                </Button>
                <Button
                  variant="secondary"
                  className="h-10 flex-1 sm:flex-none"
                  onClick={() => void submitReview()}
                  disabled={busy || !hasPlanItems || isDirty}
                >
                  Gönder
                </Button>
                <Button variant="outline" className="h-10 px-3 sm:flex-none" onClick={() => void withdraw()} disabled={busy}>
                  Geri çek
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
