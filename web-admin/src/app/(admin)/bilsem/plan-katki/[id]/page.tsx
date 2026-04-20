'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { PlanKatkiExcelPlanUpload } from '@/components/bilsem/plan-katki-excel-upload';

type Submission = {
  id: string;
  status: string;
  authorUserId: string;
  subjectCode: string;
  subjectLabel: string;
  anaGrup: string;
  altGrup: string | null;
  academicYear: string;
  planGrade: number;
  tabloAltiNot: string | null;
  itemsJson: string;
  rewardJetonPerGeneration: string;
  reviewNote: string | null;
  submittedAt: string | null;
  decidedAt: string | null;
  publishedAt: string | null;
};

const statusLabel: Record<string, string> = {
  draft: 'Taslak',
  pending_review: 'İncelemede',
  published: 'Yayında',
  rejected: 'Reddedildi',
  withdrawn: 'Geri çekildi',
};

export default function BilsemPlanKatkiDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { token, me } = useAuth();
  const [row, setRow] = useState<Submission | null>(null);
  const [itemsJson, setItemsJson] = useState('');
  const [savedItemsJson, setSavedItemsJson] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<null | 'save' | 'submit' | 'withdraw'>(null);

  const weekCount = useMemo(() => {
    try {
      const j = JSON.parse(itemsJson) as unknown;
      return Array.isArray(j) ? j.length : 0;
    } catch {
      return 0;
    }
  }, [itemsJson]);

  const planDirty = row?.status === 'draft' && itemsJson !== savedItemsJson;

  const load = useCallback(async () => {
    if (!token || !id) return;
    setLoading(true);
    setErr(null);
    try {
      const s = await apiFetch<Submission>(`/bilsem/plan-submissions/${encodeURIComponent(id)}`, { token });
      setRow(s);
      setItemsJson(s.itemsJson);
      setSavedItemsJson(s.itemsJson);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Yüklenemedi');
      setRow(null);
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveDraft() {
    if (!token || !id || !row || row.status !== 'draft') return;
    let items: unknown[];
    try {
      items = JSON.parse(itemsJson) as unknown[];
    } catch {
      setErr('Plan verisi geçersiz.');
      return;
    }
    if (!Array.isArray(items) || items.length === 0) {
      setErr('En az bir hafta gerekir.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const s = await apiFetch<Submission>(`/bilsem/plan-submissions/${encodeURIComponent(id)}`, {
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
    setErr(null);
    try {
      await apiFetch(`/bilsem/plan-submissions/${encodeURIComponent(id)}/submit`, { token, method: 'POST' });
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
    setErr(null);
    try {
      await apiFetch(`/bilsem/plan-submissions/${encodeURIComponent(id)}/withdraw`, { token, method: 'POST' });
      toast.success('Geri çekildi');
      router.push('/bilsem/plan-katki');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'İşlem başarısız');
    } finally {
      setBusy(false);
    }
  }

  async function runConfirmed() {
    if (!confirm) return;
    setConfirm(null);
    if (confirm === 'save') await saveDraft();
    else if (confirm === 'submit') await submitReview();
    else await withdraw();
  }

  function requestSubmitReview() {
    if (row?.status === 'draft' && planDirty) {
      setErr('İncelemeye göndermeden önce değişiklikleri Kaydet ile kaydedin.');
      toast.error('Önce Kaydet');
      return;
    }
    setConfirm('submit');
  }

  if (!me || (me.role !== 'teacher' && me.role !== 'school_admin')) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-3 py-4 sm:px-4">
      <Button variant="ghost" size="sm" asChild className="gap-1 px-2">
        <Link href="/bilsem/plan-katki">
          <ArrowLeft className="h-4 w-4" />
          Liste
        </Link>
      </Button>

      {loading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner label="Yükleniyor…" />
        </div>
      ) : !row ? (
        <p className="text-sm text-destructive">{err ?? 'Kayıt yok'}</p>
      ) : (
        <>
          <div>
            <h1 className="text-lg font-semibold sm:text-xl">
              {row.subjectLabel}{' '}
              <span className="text-muted-foreground">({row.subjectCode})</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {row.anaGrup}
              {row.altGrup ? ` · ${row.altGrup}` : ''} · {row.academicYear} · sınıf {row.planGrade} ·{' '}
              <span className="font-medium text-foreground">{weekCount} hafta</span> ·{' '}
              <span className="font-medium text-foreground">{statusLabel[row.status] ?? row.status}</span>
            </p>
            {row.reviewNote && (
              <p className="mt-2 rounded-md border border-border/80 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                Moderatör notu: {row.reviewNote}
              </p>
            )}
          </div>

          {err && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}

          {row.status === 'draft' && (
            <>
              <PlanKatkiExcelPlanUpload itemsJson={itemsJson} onItemsJsonChange={setItemsJson} />
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setConfirm('save')} disabled={busy}>
                  Kaydet
                </Button>
                <Button variant="secondary" onClick={() => requestSubmitReview()} disabled={busy}>
                  İncelemeye gönder
                </Button>
                <Button variant="outline" onClick={() => setConfirm('withdraw')} disabled={busy}>
                  Geri çek
                </Button>
              </div>
            </>
          )}

          {row.status === 'pending_review' && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Kayıt moderasyon kuyruğunda.</p>
              <Button variant="outline" size="sm" onClick={() => setConfirm('withdraw')} disabled={busy}>
                Kuyruktan geri çek
              </Button>
            </div>
          )}

          {row.status === 'published' && (
            <p className="text-sm text-green-700 dark:text-green-400">
              Yayında. Yıllık plan içeriği güncellendi; öğretmen Word üretiminde içerik kullanılabilir.
            </p>
          )}

          <Dialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
            <DialogContent title="Onay" descriptionId="cfm-desc">
              <p id="cfm-desc" className="text-sm text-muted-foreground">
                {confirm === 'save' && 'Taslak kaydedilsin mi?'}
                {confirm === 'submit' && 'İncelemeye gönderilsin mi? Taslak düzenlenemez.'}
                {confirm === 'withdraw' && 'Gönderim geri çekilecek; durum “Geri çekildi” olur.'}
              </p>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setConfirm(null)} disabled={busy}>
                  Vazgeç
                </Button>
                <Button
                  type="button"
                  variant={confirm === 'withdraw' ? 'destructive' : 'default'}
                  disabled={busy}
                  onClick={() => void runConfirmed()}
                >
                  Onayla
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
