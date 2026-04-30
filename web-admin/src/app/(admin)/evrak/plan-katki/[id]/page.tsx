'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle2, CircleAlert, Clock3, XCircle } from 'lucide-react';
import { PlanKatkiExcelPlanUpload } from '@/components/bilsem/plan-katki-excel-upload';

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
  const hasPlanItems = (() => {
    try {
      const parsed = JSON.parse(itemsJson) as unknown;
      return Array.isArray(parsed) && parsed.length > 0;
    } catch {
      return false;
    }
  })();

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

  const statusMeta: Record<string, { label: string; chip: string; card: string; icon: ReactNode }> = {
    draft: {
      label: 'Taslak',
      chip: 'bg-slate-100 text-slate-700 dark:bg-slate-900/50 dark:text-slate-300',
      card: 'border-slate-200/70 bg-slate-50/70 dark:border-slate-800/60 dark:bg-slate-950/30',
      icon: <Clock3 className="h-4 w-4" />,
    },
    pending_review: {
      label: 'İncelemede',
      chip: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
      card: 'border-amber-200/70 bg-amber-50/80 dark:border-amber-800/40 dark:bg-amber-950/30',
      icon: <Clock3 className="h-4 w-4" />,
    },
    published: {
      label: 'Onaylandı',
      chip: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
      card: 'border-emerald-200/70 bg-emerald-50/80 dark:border-emerald-800/40 dark:bg-emerald-950/30',
      icon: <CheckCircle2 className="h-4 w-4" />,
    },
    rejected: {
      label: 'Reddedildi',
      chip: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200',
      card: 'border-rose-200/70 bg-rose-50/80 dark:border-rose-800/40 dark:bg-rose-950/30',
      icon: <XCircle className="h-4 w-4" />,
    },
    withdrawn: {
      label: 'Geri çekildi',
      chip: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300',
      card: 'border-zinc-200/70 bg-zinc-50/80 dark:border-zinc-800/50 dark:bg-zinc-950/30',
      icon: <CircleAlert className="h-4 w-4" />,
    },
  };
  const meta = row ? (statusMeta[row.status] ?? statusMeta.pending_review) : null;

  return (
    <div className="mx-auto max-w-3xl space-y-3 px-2 pb-8 pt-1 sm:px-4">
      {row && (
        <div className="relative overflow-hidden rounded-2xl border border-amber-200/60 bg-linear-to-br from-amber-100/60 via-white to-violet-100/40 p-3 dark:border-amber-800/30 dark:from-amber-950/20 dark:via-zinc-950 dark:to-violet-950/20">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-40 dark:opacity-20"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='120' viewBox='0 0 160 120'%3E%3Cg fill='none' stroke='%23f59e0b' stroke-opacity='0.25'%3E%3Cpath d='M10 110L80 10l70 100'/%3E%3Ccircle cx='80' cy='68' r='14'/%3E%3C/g%3E%3C/svg%3E\")",
            }}
          />
          <h1 className="relative text-base font-bold sm:text-lg">{row.subjectLabel}</h1>
        </div>
      )}
      <Button variant="ghost" size="sm" asChild className="h-8 gap-0.5 px-2 text-xs">
        <Link href="/evrak/plan-katki"><ArrowLeft className="h-3.5 w-3.5" />Liste</Link>
      </Button>

      {loading ? (
        <div className="flex justify-center py-10"><LoadingSpinner label="Yükleniyor…" /></div>
      ) : !row ? (
        <p className="text-sm text-destructive">{err ?? 'Kayıt yok'}</p>
      ) : (
        <>
          <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
            Durum:{' '}
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold sm:text-[11px] ${meta?.chip ?? ''}`}>
              {meta?.label ?? row.status}
            </span>{' '}
            · {row.grade}. sınıf{row.section ? ` · ${row.section}` : ''} · {row.academicYear}
          </div>
          {(row.reviewNote || row.status !== 'draft') && (
            <div className={`rounded-xl border px-3 py-2.5 ${meta?.card ?? ''}`}>
              <div className="flex items-start gap-2">
                <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/70 text-foreground dark:bg-black/20">
                  {meta?.icon}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold sm:text-sm">Onay bilgisi</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
                    {row.reviewNote?.trim() || 'Moderasyon notu bulunmuyor. Durum güncellemeleri burada görünür.'}
                  </p>
                </div>
              </div>
            </div>
          )}
          {row.status === 'draft' && (
            <>
              <PlanKatkiExcelPlanUpload itemsJson={itemsJson} onItemsJsonChange={setItemsJson} />
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void saveDraft()} disabled={busy}>Taslağı kaydet</Button>
                <Button variant="secondary" onClick={() => void submitReview()} disabled={busy || !hasPlanItems}>Moderasyona gönder</Button>
                <Button variant="outline" onClick={() => void withdraw()} disabled={busy}>Geri çek</Button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
