'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';
import { CheckCircle2, Sparkles, XCircle } from 'lucide-react';

type Row = {
  id: string;
  status: string;
  subjectCode: string;
  subjectLabel: string;
  grade: number;
  section: string | null;
  academicYear: string;
  submittedAt: string | null;
  itemsJson: string;
};

function weekCount(itemsJson: string): number {
  try {
    const j = JSON.parse(itemsJson) as unknown;
    return Array.isArray(j) ? j.length : 0;
  } catch {
    return 0;
  }
}

export function PlanIcerikKatkiModerasyonPanel({ embedded = false }: { embedded?: boolean }) {
  const { token, me } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch<Row[]>('/yillik-plan-icerik/submissions/moderation/pending', { token });
      setRows(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Liste alınamadı');
      setRows([]);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function publish(id: string) {
    if (!token) return;
    setBusyId(id);
    try {
      await apiFetch(`/yillik-plan-icerik/submissions/moderation/${encodeURIComponent(id)}/publish`, {
        token,
        method: 'POST',
        body: JSON.stringify({}),
      });
      toast.success('Yayınlandı');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Yayınlanamadı');
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: string) {
    if (!token) return;
    setBusyId(id);
    try {
      await apiFetch(`/yillik-plan-icerik/submissions/moderation/${encodeURIComponent(id)}/reject`, {
        token,
        method: 'POST',
        body: JSON.stringify({}),
      });
      toast.success('Reddedildi');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Reddedilemedi');
    } finally {
      setBusyId(null);
    }
  }

  if (!me || (me.role !== 'superadmin' && me.role !== 'moderator')) return null;

  return (
    <div className={embedded ? 'space-y-3' : 'mx-auto max-w-3xl space-y-3 px-3 pb-8 pt-1 sm:px-4'}>
      <div className="relative overflow-hidden rounded-2xl border border-emerald-200/60 bg-gradient-to-br from-emerald-100/60 via-white to-cyan-100/40 p-3 dark:border-emerald-800/30 dark:from-emerald-950/20 dark:via-zinc-950 dark:to-cyan-950/20">
        <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-emerald-400/20 blur-2xl" aria-hidden />
        <div className="relative flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold tracking-tight sm:text-base"><Sparkles className="h-4 w-4 text-emerald-600" />Evrak plan katkı moderasyonu</h2>
          <span className="text-[10px] text-emerald-700/80 dark:text-emerald-300/80 sm:text-xs">Pastel kontrol paneli</span>
        </div>
        <Button size="sm" variant="ghost" onClick={() => void load()}>Yenile</Button>
      </div>
      {err && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">{err}</div>}
      {rows === null ? (
        <div className="flex justify-center py-10"><LoadingSpinner label="Yükleniyor…" /></div>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">Kuyruk boş.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="rounded-xl border border-emerald-200/50 bg-gradient-to-r from-emerald-50/70 to-white p-3 dark:border-emerald-800/30 dark:from-emerald-950/20 dark:to-zinc-950">
              <p className="text-sm font-semibold">{r.subjectLabel}</p>
              <p className="text-[11px] text-muted-foreground">{r.grade}. sınıf{r.section ? ` · ${r.section}` : ''} · {r.academicYear} · {weekCount(r.itemsJson)} hafta</p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" disabled={busyId === r.id} onClick={() => void publish(r.id)}><CheckCircle2 className="mr-1 h-3.5 w-3.5" />Yayınla</Button>
                <Button size="sm" variant="destructive" disabled={busyId === r.id} onClick={() => void reject(r.id)}><XCircle className="mr-1 h-3.5 w-3.5" />Reddet</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
