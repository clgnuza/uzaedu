'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Eye, RefreshCw } from 'lucide-react';

type QueueRow = {
  id: string;
  status: string;
  authorUserId: string;
  authorEmail: string | null;
  authorDisplayName: string | null;
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

type SubmissionDetail = {
  id: string;
  itemsJson: string;
  subjectLabel: string;
  subjectCode: string;
  anaGrup: string;
  altGrup: string | null;
  academicYear: string;
  planGrade: number;
};

function authorLabel(r: QueueRow) {
  const name = r.authorDisplayName?.trim();
  if (name) return name;
  if (r.authorEmail) return r.authorEmail;
  return r.authorUserId.slice(0, 8) + '…';
}

export default function BilsemPlanKatkiModerasyonPage() {
  const { token, me } = useAuth();
  const [rows, setRows] = useState<QueueRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rewardById, setRewardById] = useState<Record<string, string>>({});

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewRow, setPreviewRow] = useState<QueueRow | null>(null);
  const [previewBody, setPreviewBody] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);

  const [publishOpen, setPublishOpen] = useState(false);
  const [publishRow, setPublishRow] = useState<QueueRow | null>(null);
  const [publishReward, setPublishReward] = useState('0.25');
  const [publishNote, setPublishNote] = useState('');

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectRow, setRejectRow] = useState<QueueRow | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null);
    try {
      const data = await apiFetch<QueueRow[]>('/bilsem/plan-submissions/moderation/pending', { token });
      setRows(data);
      setRewardById((prev) => {
        const next = { ...prev };
        for (const r of data) {
          if (next[r.id] === undefined) next[r.id] = '0.25';
        }
        return next;
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Liste alınamadı');
      setRows([]);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openPreview(r: QueueRow) {
    if (!token) return;
    setPreviewRow(r);
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewBody('');
    try {
      const d = await apiFetch<SubmissionDetail>(
        `/bilsem/plan-submissions/moderation/${encodeURIComponent(r.id)}`,
        { token },
      );
      try {
        const parsed = JSON.parse(d.itemsJson) as unknown;
        setPreviewBody(JSON.stringify(parsed, null, 2));
      } catch {
        setPreviewBody(d.itemsJson);
      }
    } catch (e) {
      setPreviewBody(e instanceof Error ? e.message : 'Yüklenemedi');
    } finally {
      setPreviewLoading(false);
    }
  }

  function openPublish(r: QueueRow) {
    setPublishRow(r);
    setPublishReward(rewardById[r.id] ?? '0.25');
    setPublishNote('');
    setPublishOpen(true);
  }

  async function confirmPublish() {
    if (!token || !publishRow) return;
    const n = Number.parseFloat(publishReward);
    const reward = Number.isFinite(n) ? n : 0.25;
    setBusyId(publishRow.id);
    setErr(null);
    try {
      const res = await apiFetch<{ imported_weeks?: number }>(
        `/bilsem/plan-submissions/moderation/${encodeURIComponent(publishRow.id)}/publish`,
        {
          token,
          method: 'POST',
          body: JSON.stringify({
            reward_jeton_per_generation: reward,
            review_note: publishNote.trim() || null,
          }),
        },
      );
      toast.success(`Yayınlandı (${res.imported_weeks ?? '?'} hafta)`);
      setPublishOpen(false);
      setPublishRow(null);
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Yayınlanamadı';
      setErr(msg);
      toast.error(msg);
    } finally {
      setBusyId(null);
    }
  }

  function openReject(r: QueueRow) {
    setRejectRow(r);
    setRejectNote('');
    setRejectOpen(true);
  }

  async function confirmReject() {
    if (!token || !rejectRow) return;
    setBusyId(rejectRow.id);
    setErr(null);
    try {
      await apiFetch(`/bilsem/plan-submissions/moderation/${encodeURIComponent(rejectRow.id)}/reject`, {
        token,
        method: 'POST',
        body: JSON.stringify({ review_note: rejectNote.trim() || null }),
      });
      toast.success('Reddedildi');
      setRejectOpen(false);
      setRejectRow(null);
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Reddedilemedi';
      setErr(msg);
      toast.error(msg);
    } finally {
      setBusyId(null);
    }
  }

  if (!me || (me.role !== 'superadmin' && me.role !== 'moderator')) return null;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-3 py-4 sm:px-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold sm:text-xl">Bilsem plan katkı moderasyonu</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Kuyruktaki gönderimleri önizleyin; yayınlayınca mevcut yıllık plan satırları aynı ders / ana grup /
            alt grup / yıl için yenilenir. Jeton, her başarılı Word üretiminde (tek kaynak gönderim) üreticiye
            yazılır.
          </p>
        </div>
        <Button variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={() => void load()} disabled={rows === null}>
          <RefreshCw className="h-3.5 w-3.5" />
          Yenile
        </Button>
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
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Bekleyen gönderim yok.</p>
      ) : (
        <ul className="space-y-4">
          {rows.map((r) => (
            <li
              key={r.id}
              className="rounded-xl border border-border bg-card p-4 shadow-sm dark:border-border/80 dark:bg-card/40"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-medium">
                    {r.subjectLabel}{' '}
                    <span className="text-muted-foreground">({r.subjectCode})</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {r.anaGrup}
                    {r.altGrup ? ` · ${r.altGrup}` : ''} · {r.academicYear} · plan sınıfı {r.planGrade} ·{' '}
                    <span className="font-medium text-foreground">{r.weekCount} hafta</span>
                  </p>
                  <p className="text-sm text-foreground">
                    <span className="text-muted-foreground">Yazar:</span> {authorLabel(r)}
                  </p>
                  <p className="font-mono text-[10px] text-muted-foreground/90">id {r.id}</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                  <div className="space-y-1">
                    <Label className="text-xs">Jeton / üretim</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      max={50}
                      className="h-9 w-28"
                      value={rewardById[r.id] ?? '0.25'}
                      onChange={(e) => setRewardById((m) => ({ ...m, [r.id]: e.target.value }))}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => void openPreview(r)}>
                      <Eye className="h-3.5 w-3.5" />
                      Önizle
                    </Button>
                    <Button size="sm" disabled={busyId === r.id} onClick={() => openPublish(r)}>
                      Yayınla…
                    </Button>
                    <Button size="sm" variant="destructive" disabled={busyId === r.id} onClick={() => openReject(r)}>
                      Reddet…
                    </Button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent title="Haftalar (JSON)" className="max-w-2xl" descriptionId="pv-desc">
          <p id="pv-desc" className="sr-only">
            Gönderilen plan satırları
          </p>
          {previewRow && (
            <p className="mb-2 text-sm text-muted-foreground">
              {previewRow.subjectLabel} — {previewRow.weekCount} hafta (önizleme)
            </p>
          )}
          {previewLoading ? (
            <LoadingSpinner label="Yükleniyor…" />
          ) : (
            <pre className="max-h-[min(60vh,28rem)] overflow-auto rounded-lg border border-border/80 bg-muted/20 p-3 font-mono text-[11px] leading-relaxed">
              {previewBody}
            </pre>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPreviewOpen(false)}>
              Kapat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent title="Yayımla" descriptionId="pub-desc">
          <p id="pub-desc" className="text-sm text-muted-foreground">
            Katalogdaki aynı anahtardaki haftalar silinip bu gönderimle değiştirilecek.
          </p>
          {publishRow && (
            <p className="text-sm font-medium text-foreground">
              {publishRow.subjectLabel} · {publishRow.weekCount} hafta
            </p>
          )}
          <div className="space-y-2">
            <Label>Jeton / üretim</Label>
            <Input type="number" step="0.01" min={0} max={50} value={publishReward} onChange={(e) => setPublishReward(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Not (opsiyonel)</Label>
            <textarea
              className="min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
              value={publishNote}
              onChange={(e) => setPublishNote(e.target.value)}
              placeholder="Yayımla notu (yazar görebilir)"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPublishOpen(false)}>
              Vazgeç
            </Button>
            <Button type="button" disabled={busyId !== null} onClick={() => void confirmPublish()}>
              Onayla ve yayınla
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent title="Reddet" descriptionId="rj-desc">
          <p id="rj-desc" className="text-sm text-muted-foreground">
            Gönderim reddedilir; katalog değişmez.
          </p>
          {rejectRow && <p className="text-sm font-medium">{rejectRow.subjectLabel}</p>}
          <div className="space-y-2">
            <Label>Red gerekçesi</Label>
            <textarea
              className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="Kısa açıklama (yazar görebilir)"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRejectOpen(false)}>
              Vazgeç
            </Button>
            <Button type="button" variant="destructive" disabled={busyId !== null} onClick={() => void confirmReject()}>
              Reddet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
