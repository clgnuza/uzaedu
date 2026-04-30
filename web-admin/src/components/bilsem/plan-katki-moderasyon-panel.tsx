'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Alert } from '@/components/ui/alert';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  History,
  Inbox,
  RefreshCw,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

type ModerationValidation = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  catalogMatch: boolean;
};

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
  planGrade: number | null;
  weekCount: number;
  submittedAt: string | null;
  updatedAt: string;
  createdAt: string;
  decidedAt?: string | null;
  publishedAt?: string | null;
};

type ModerationDashboard = {
  pending: number;
  published: number;
  rejected: number;
  withdrawn: number;
};

type HistoryRow = QueueRow & {
  reviewerLabel: string | null;
  decidedAt: string | null;
  publishedAt: string | null;
};

function fmtMod(iso: string | null | undefined) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '—';
  }
}

type SubmissionDetail = {
  id: string;
  itemsJson: string;
  subjectLabel: string;
  subjectCode: string;
  anaGrup: string;
  altGrup: string | null;
  academicYear: string;
  planGrade: number | null;
};

function authorLabel(r: QueueRow) {
  const name = r.authorDisplayName?.trim();
  if (name) return name;
  if (r.authorEmail) return r.authorEmail;
  return r.authorUserId.slice(0, 8) + '…';
}

function modListQs(applied: { year: string; ana: string; q: string }) {
  const p = new URLSearchParams();
  if (applied.year) p.set('academic_year', applied.year);
  if (applied.ana) p.set('ana_grup', applied.ana);
  if (applied.q) p.set('q', applied.q);
  const s = p.toString();
  return s ? `?${s}` : '';
}

export function PlanKatkiModerasyonPanel({ embedded = false }: { embedded?: boolean }) {
  const { token, me } = useAuth();
  const [rows, setRows] = useState<QueueRow[] | null>(null);
  const [historyRows, setHistoryRows] = useState<HistoryRow[] | null>(null);
  const [dashboard, setDashboard] = useState<ModerationDashboard | null>(null);
  const [view, setView] = useState<'queue' | 'history'>('queue');
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

  const [filterDraft, setFilterDraft] = useState({ year: '', ana: '', q: '' });
  const [filterApplied, setFilterApplied] = useState({ year: '', ana: '', q: '' });

  const [unpublishOpen, setUnpublishOpen] = useState(false);
  const [unpublishRow, setUnpublishRow] = useState<HistoryRow | null>(null);
  const [unpublishNote, setUnpublishNote] = useState('');

  const [validationById, setValidationById] = useState<
    Record<string, ModerationValidation | 'loading' | 'error' | undefined>
  >({});

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null);
    const fq = modListQs(filterApplied);
    try {
      const [data, dash] = await Promise.all([
        apiFetch<QueueRow[]>(`/bilsem/plan-submissions/moderation/pending${fq}`, { token }),
        apiFetch<ModerationDashboard>('/bilsem/plan-submissions/moderation/summary', { token }),
      ]);
      setRows(data);
      setDashboard(dash);
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
  }, [token, filterApplied]);

  const loadHistory = useCallback(async () => {
    if (!token) return;
    const p = new URLSearchParams({ limit: '50' });
    if (filterApplied.year) p.set('academic_year', filterApplied.year);
    if (filterApplied.ana) p.set('ana_grup', filterApplied.ana);
    if (filterApplied.q) p.set('q', filterApplied.q);
    try {
      const h = await apiFetch<HistoryRow[]>(
        `/bilsem/plan-submissions/moderation/history?${p.toString()}`,
        { token },
      );
      setHistoryRows(h);
    } catch {
      setHistoryRows([]);
    }
  }, [token, filterApplied]);

  useEffect(() => {
    void load();
  }, [load]);

  const rowQueueKey = `${modListQs(filterApplied)}|${rows === null ? '' : rows.map((r) => r.id).join('|')}`;
  useEffect(() => {
    if (!token || !rows || rows.length === 0) return;
    setValidationById((m) => {
      const o = { ...m };
      for (const r of rows) o[r.id] = 'loading';
      return o;
    });
    let cancel = false;
    void (async () => {
      const results = await Promise.all(
        rows.map(async (r) => {
          try {
            const v = await apiFetch<ModerationValidation>(
              `/bilsem/plan-submissions/moderation/${encodeURIComponent(r.id)}/validate`,
              { token },
            );
            return { id: r.id, v: v as ModerationValidation };
          } catch {
            return { id: r.id, v: 'error' as const };
          }
        }),
      );
      if (cancel) return;
      setValidationById((m) => {
        const o = { ...m };
        for (const { id, v } of results) {
          o[id] = v === 'error' ? { ok: false, errors: ['Doğrulama alınamadı'], warnings: [], catalogMatch: false } : v;
        }
        return o;
      });
    })();
    return () => {
      cancel = true;
    };
  }, [token, rowQueueKey, rows]);

  useEffect(() => {
    if (view !== 'history' || !token) return;
    setHistoryRows(null);
    void loadHistory();
  }, [view, token, filterApplied, loadHistory]);

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
      setHistoryRows(null);
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
      setHistoryRows(null);
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Reddedilemedi';
      setErr(msg);
      toast.error(msg);
    } finally {
      setBusyId(null);
    }
  }

  function openUnpublish(r: HistoryRow) {
    setUnpublishRow(r);
    setUnpublishNote('');
    setUnpublishOpen(true);
  }

  async function confirmUnpublish() {
    if (!token || !unpublishRow) return;
    setBusyId(unpublishRow.id);
    setErr(null);
    try {
      await apiFetch(
        `/bilsem/plan-submissions/moderation/${encodeURIComponent(unpublishRow.id)}/unpublish`,
        {
          token,
          method: 'POST',
          body: JSON.stringify({ note: unpublishNote.trim() || null }),
        },
      );
      toast.success('Yayından kaldırıldı; inceleme kuyruğuna alındı');
      setUnpublishOpen(false);
      setUnpublishRow(null);
      setHistoryRows(null);
      await load();
      if (view === 'history') void loadHistory();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Kaldırılamadı';
      setErr(msg);
      toast.error(msg);
    } finally {
      setBusyId(null);
    }
  }

  if (!me || (me.role !== 'superadmin' && me.role !== 'moderator')) return null;

  const nPending = rows?.length ?? 0;
  const heading = embedded ? (
    <h2 className="text-sm font-semibold tracking-tight sm:text-base">Bilsem plan katkı moderasyonu</h2>
  ) : (
    <h1 className="text-sm font-semibold tracking-tight sm:text-base">Bilsem plan katkı moderasyonu</h1>
  );

  return (
    <div
      className={cn(
        'space-y-3',
        embedded ? 'px-0 pb-0 pt-0' : 'mx-auto max-w-2xl px-3 pb-8 pt-1 sm:px-4',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
        {heading}
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium sm:px-2 sm:text-xs',
              nPending > 0
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200'
                : 'border-border bg-muted/50 text-muted-foreground',
            )}
          >
            <Inbox className="h-3 w-3" />
            {nPending} kuyrukta
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1 px-2 text-xs"
            onClick={() => {
              void load();
              if (view === 'history') void loadHistory();
            }}
            disabled={rows === null}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Yenile
          </Button>
        </div>
      </div>

      <Alert variant="info" className="py-2.5 px-3 text-foreground">
        <p className="text-[11px] leading-snug text-muted-foreground sm:text-xs">
          <span className="font-medium text-foreground">Kısaca:</span> Her satırda <strong className="text-foreground">sistem uyum kontrolü</strong> (katalog, hafta, JSON) sonucu gösterilir; hata varken yayın kapalı, düzeltme veya ret için içeriğe bakın. Onayda katalog güncellenir, jeton yazılır.
        </p>
      </Alert>

      {dashboard && (
        <p className="flex flex-wrap gap-1.5 text-[10px] leading-relaxed sm:text-xs">
          <span className="inline-flex items-center rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 font-medium text-amber-900 dark:text-amber-200">
            Bekleyen {dashboard.pending}
          </span>
          <span className="inline-flex items-center rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 font-medium text-emerald-900 dark:text-emerald-200">
            Yayın (top.) {dashboard.published}
          </span>
          <span className="inline-flex items-center rounded-md border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 font-medium text-rose-900 dark:text-rose-200">
            Red {dashboard.rejected}
          </span>
          <span className="inline-flex items-center rounded-md border border-slate-400/30 bg-slate-500/10 px-1.5 py-0.5 font-medium text-slate-800 dark:text-slate-200">
            Geri alınan {dashboard.withdrawn}
          </span>
        </p>
      )}

      <div
        className="flex max-w-md gap-1"
        role="tablist"
        aria-label="Liste görünümü"
      >
        {(
          [
            { id: 'queue' as const, label: 'İnceleme kuyruğu', short: 'Kuyruk', Icon: Inbox, color: 'amber' as const },
            { id: 'history' as const, label: 'Onay geçmişi', short: 'Geçmiş', Icon: History, color: 'violet' as const },
          ] as const
        ).map(({ id, label, short, Icon, color }) => {
          const isActive = view === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setView(id)}
              className={cn(
                'flex min-h-8 min-w-0 flex-1 items-center justify-center gap-1 rounded-md border px-2 text-[10px] font-medium transition-colors sm:gap-1.5 sm:text-xs',
                isActive && color === 'amber' && 'border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-200',
                isActive &&
                  color === 'violet' &&
                  'border-violet-500/50 bg-violet-500/10 text-violet-900 dark:text-violet-200',
                !isActive && 'border-transparent bg-muted/50 text-muted-foreground hover:bg-muted/80',
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="sm:hidden">{short}</span>
              <span className="hidden sm:inline">{label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-border/50 bg-card/50 p-2.5 sm:flex-row sm:items-end sm:gap-2">
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="space-y-0.5">
            <Label className="text-[10px] text-muted-foreground">Öğretim yılı</Label>
            <Input
              className="h-8 text-xs"
              value={filterDraft.year}
              onChange={(e) => setFilterDraft((d) => ({ ...d, year: e.target.value }))}
              placeholder="ör. 2024-2025"
            />
          </div>
          <div className="space-y-0.5">
            <Label className="text-[10px] text-muted-foreground">Ana grup</Label>
            <Input
              className="h-8 text-xs"
              value={filterDraft.ana}
              onChange={(e) => setFilterDraft((d) => ({ ...d, ana: e.target.value }))}
              placeholder="Kısmi eşleşme"
            />
          </div>
          <div className="space-y-0.5">
            <Label className="text-[10px] text-muted-foreground">Ara (ders / kod / yazar)</Label>
            <Input
              className="h-8 text-xs"
              value={filterDraft.q}
              onChange={(e) => setFilterDraft((d) => ({ ...d, q: e.target.value }))}
              placeholder="Metin"
            />
          </div>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <Button
            type="button"
            size="sm"
            className="h-8"
            onClick={() =>
              setFilterApplied({
                year: filterDraft.year.trim(),
                ana: filterDraft.ana.trim(),
                q: filterDraft.q.trim(),
              })
            }
          >
            Filtrele
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => {
              setFilterDraft({ year: '', ana: '', q: '' });
              setFilterApplied({ year: '', ana: '', q: '' });
            }}
          >
            Sıfırla
          </Button>
        </div>
      </div>
      {(filterApplied.year || filterApplied.ana || filterApplied.q) && (
        <p className="text-[10px] text-muted-foreground">
          Liste filtresi aktif (kuyruk + geçmiş aynı koşullar; her yayımlama hâlâ{' '}
          <span className="font-medium text-foreground">tek</span> seçilen satıra aittir).
        </p>
      )}

      {err && (
        <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-xs text-rose-800 dark:text-rose-200">
          {err}
        </div>
      )}

      {view === 'history' && historyRows === null ? (
        <div className="flex justify-center py-10">
          <LoadingSpinner label="Geçmiş yükleniyor…" />
        </div>
      ) : view === 'history' && (historyRows?.length ?? 0) === 0 ? (
        <div className="rounded-lg border border-dashed border-violet-300/40 bg-violet-500/5 py-6 text-center dark:border-violet-500/20">
          <History className="mx-auto mb-1.5 h-6 w-6 text-violet-400" />
          <p className="text-xs font-medium text-foreground">Kayıt yok</p>
          <p className="mt-0.5 px-3 text-[11px] text-muted-foreground">
            Yayımlanan veya reddedilen gönderiler burada listelenir; yeşil kenar yayımlanan, kırmızı kenar reddedilen
            anlamına gelir.
          </p>
        </div>
      ) : view === 'history' ? (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {historyRows!.map((r) => {
            const isPub = r.status === 'published';
            return (
              <li
                key={r.id}
                className={cn(
                  'border-l-4 pl-2 pr-1.5 py-2 sm:pl-3',
                  isPub
                    ? 'border-l-emerald-500 bg-emerald-500/4'
                    : 'border-l-rose-500 bg-rose-500/4',
                )}
              >
                <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium uppercase text-muted-foreground">
                      {isPub ? 'Yayınlandı' : 'Reddedildi'}
                    </p>
                    <p className="mt-0.5 truncate text-sm font-semibold">
                      {r.subjectLabel}{' '}
                      <span className="font-normal text-muted-foreground">· {r.academicYear} · {r.weekCount} hft</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground sm:text-xs">
                      {authorLabel(r)} · {r.anaGrup}
                      {r.altGrup ? ` / ${r.altGrup}` : ''}
                    </p>
                    <p className="mt-0.5 text-[10px] text-foreground/90 sm:text-xs">
                      <span className="inline-flex items-center gap-0.5">
                        <Clock className="h-3 w-3 opacity-50" />
                        Karar {fmtMod(r.decidedAt)}
                      </span>
                      {r.publishedAt && <span className="text-muted-foreground"> · Katalog {fmtMod(r.publishedAt)}</span>}
                    </p>
                    {r.reviewerLabel && (
                      <p className="text-[10px] text-muted-foreground">İnceleyen: {r.reviewerLabel}</p>
                    )}
                    <p className="font-mono text-[9px] text-muted-foreground/60">id {r.id}</p>
                  </div>
                  <div className="flex w-full flex-col gap-1.5 sm:mt-4 sm:w-auto sm:items-end">
                    {isPub && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-full gap-1 border-amber-600/40 text-amber-900 hover:bg-amber-500/10 sm:w-auto dark:text-amber-200"
                        disabled={busyId === r.id}
                        onClick={() => openUnpublish(r)}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Yayından kaldır
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 w-full shrink-0 gap-1 sm:w-auto"
                      onClick={() => void openPreview(r as QueueRow)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      İçerik
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : rows === null ? (
        <div className="flex justify-center py-10">
          <LoadingSpinner label="Yükleniyor…" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-amber-400/40 bg-amber-500/5 py-6 text-center">
          <Sparkles className="mx-auto mb-1.5 h-6 w-6 text-amber-500" />
          <p className="text-xs font-medium">Kuyruk boş</p>
          <p className="mt-0.5 px-3 text-[11px] text-muted-foreground">İncelenecek gönderi yok; yeni gelince turuncu şeritli satırlar görünür.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {rows.map((r) => {
            const val = validationById[r.id];
            const canPublish =
              val && typeof val === 'object' && 'ok' in val && (val as ModerationValidation).ok;
            return (
            <li key={r.id} className="border-l-4 border-l-amber-500 bg-amber-500/4 p-2 pl-2.5 sm:pl-3">
              <div className="space-y-2">
                <p className="text-[10px] font-medium uppercase text-amber-800 dark:text-amber-200">İncelenecek</p>
                <p className="text-sm font-semibold leading-tight">
                  {r.subjectLabel}{' '}
                  <span className="font-normal text-muted-foreground">({r.subjectCode})</span>
                </p>
                <p className="text-[10px] text-muted-foreground sm:text-xs">
                  {r.anaGrup}
                  {r.altGrup ? ` · ${r.altGrup}` : ''} · {r.academicYear} · {r.weekCount} hafta
                </p>
                {r.submittedAt && (
                  <p className="text-[10px] text-sky-800 dark:text-sky-200">Gönderim: {fmtMod(r.submittedAt)}</p>
                )}
                <p className="text-xs text-foreground">
                  <span className="text-muted-foreground">Yazar:</span> {authorLabel(r)}
                </p>
                <p className="font-mono text-[9px] text-muted-foreground/70">id {r.id}</p>
                <div className="rounded-md border border-border/80 bg-background/60 px-2 py-1.5">
                  <p className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">Uyum kontrolü</p>
                  {val === 'loading' || val === undefined ? (
                    <p className="text-[10px] text-muted-foreground">Kontrol ediliyor…</p>
                  ) : val && typeof val === 'object' && 'ok' in val && !val.ok ? (
                    <div className="mt-1 space-y-0.5 rounded border border-rose-500/35 bg-rose-500/10 px-2 py-1.5">
                      <p className="flex items-center gap-1 text-[10px] font-medium text-rose-800 dark:text-rose-200">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        Yayına uygun değil
                      </p>
                      <ul className="list-inside list-disc text-[10px] leading-relaxed text-rose-900/90 dark:text-rose-100/90">
                        {val.errors.map((e, i) => (
                          <li key={i}>{e}</li>
                        ))}
                      </ul>
                    </div>
                  ) : val && typeof val === 'object' && val.ok ? (
                    <div className="mt-1 space-y-1">
                      <p className="flex items-center gap-1 text-[10px] font-medium text-emerald-800 dark:text-emerald-200">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                        Sistem kontrolü geçti, yayınlanabilir
                      </p>
                      {val.warnings.length > 0 && (
                        <div className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1.5">
                          <p className="flex items-center gap-1 text-[10px] font-medium text-amber-900 dark:text-amber-200">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                            Uyarı
                          </p>
                          <ul className="mt-0.5 list-inside list-disc text-[10px] text-amber-900/90 dark:text-amber-100/90">
                            {val.warnings.map((w, i) => (
                              <li key={i}>{w}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-[10px] text-rose-700 dark:text-rose-300">Durum alınamadı.</p>
                  )}
                </div>
                <div className="flex flex-wrap items-end gap-2 border-t border-amber-500/10 pt-2">
                  <div className="w-24 min-w-0 space-y-0.5 sm:w-28">
                    <Label className="text-[10px] text-amber-900 dark:text-amber-200">Jeton / üretim</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      max={50}
                      className="h-8 text-xs"
                      value={rewardById[r.id] ?? '0.25'}
                      onChange={(e) => setRewardById((m) => ({ ...m, [r.id]: e.target.value }))}
                    />
                  </div>
                  <div className="flex flex-1 flex-wrap items-center justify-end gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 border-sky-400/50 text-sky-800 hover:bg-sky-500/10 dark:text-sky-200"
                      onClick={() => void openPreview(r)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Önizle
                    </Button>
                    <Button
                      size="sm"
                      className="h-8 bg-emerald-600 hover:bg-emerald-600/90"
                      disabled={busyId === r.id || !canPublish}
                      title={!canPublish ? 'Önce tüm hatalar giderilmeli (katalog / hafta / JSON)' : undefined}
                      onClick={() => openPublish(r)}
                    >
                      Yayınla
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-8"
                      disabled={busyId === r.id}
                      onClick={() => openReject(r)}
                    >
                      Reddet
                    </Button>
                  </div>
                </div>
              </div>
            </li>
            );
          })}
        </ul>
      )}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent title="Haftalar" className="max-w-2xl border-sky-200/40" descriptionId="pv-desc">
          <p id="pv-desc" className="sr-only">
            Gönderilen plan satırları
          </p>
          {previewRow && (
            <p className="text-xs text-muted-foreground sm:text-sm">
              <span className="font-medium text-sky-700 dark:text-sky-300">Önizleme</span> · {previewRow.subjectLabel} —{' '}
              {previewRow.weekCount} hafta
            </p>
          )}
          {previewLoading ? (
            <LoadingSpinner label="Yükleniyor…" />
          ) : (
            <pre className="max-h-[min(50vh,24rem)] overflow-auto rounded-xl border border-border/60 bg-slate-950/90 p-2.5 font-mono text-[10px] leading-relaxed text-slate-100 sm:p-3 sm:text-[11px]">
              {previewBody}
            </pre>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPreviewOpen(false)} size="sm">
              Kapat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent title="Yayımla" className="border-emerald-200/30 dark:border-emerald-900/40" descriptionId="pub-desc">
          <p id="pub-desc" className="text-xs text-muted-foreground sm:text-sm">
            Aynı ders/ana/alt/yıl kataloğu bu haftalarla değişecek.
            {(filterApplied.year || filterApplied.ana || filterApplied.q) && (
              <span className="mt-1 block text-amber-900/90 dark:text-amber-200/95">
                Üstte filtre açık; sadece filtreyle görünen kuyruktan onaylarsınız, işlem yine bu gönderi için.
              </span>
            )}
          </p>
          {publishRow && (
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
              {publishRow.subjectLabel} · {publishRow.weekCount} hafta
            </p>
          )}
          <div className="space-y-1.5">
            <Label className="text-emerald-800 dark:text-emerald-200">Jeton / üretim</Label>
            <Input
              type="number"
              step="0.01"
              min={0}
              max={50}
              value={publishReward}
              onChange={(e) => setPublishReward(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Not (opsiyonel)</Label>
            <textarea
              className="min-h-[64px] w-full rounded-lg border border-input bg-background px-2.5 py-2 text-sm shadow-sm"
              value={publishNote}
              onChange={(e) => setPublishNote(e.target.value)}
              placeholder="Yazar görebilir"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setPublishOpen(false)} size="sm">
              Vazgeç
            </Button>
            <Button
              type="button"
              className="bg-emerald-600 hover:bg-emerald-600/90"
              disabled={busyId !== null}
              onClick={() => void confirmPublish()}
              size="sm"
            >
              Onayla ve yayınla
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent title="Reddet" className="border-rose-200/40 dark:border-rose-900/50" descriptionId="rj-desc">
          <p id="rj-desc" className="text-xs text-muted-foreground sm:text-sm">
            Katalog değişmez; yazar gerekçeyi görebilir.
          </p>
          {rejectRow && <p className="text-sm font-medium text-rose-900 dark:text-rose-100">{rejectRow.subjectLabel}</p>}
          <div className="space-y-1.5">
            <Label>Red gerekçesi</Label>
            <textarea
              className="min-h-[80px] w-full rounded-lg border border-input bg-background px-2.5 py-2 text-sm"
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="Kısa açıklama"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRejectOpen(false)} size="sm">
              Vazgeç
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busyId !== null}
              onClick={() => void confirmReject()}
              size="sm"
            >
              Reddet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={unpublishOpen} onOpenChange={setUnpublishOpen}>
        <DialogContent title="Yayından kaldır" className="border-amber-200/40" descriptionId="unpub-desc">
          <p id="unpub-desc" className="text-xs text-muted-foreground sm:text-sm">
            Katalogdaki bu gönderime ait haftalar silinir; kayıt inceleme kuyruğuna döner (yazar düzenleyebilir). Ödül
            cüzdan hareketleri geçmiş kayıt olarak kalır.
          </p>
          {unpublishRow && (
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200">{unpublishRow.subjectLabel}</p>
          )}
          <div className="space-y-1.5">
            <Label>Not (opsiyonel)</Label>
            <textarea
              className="min-h-[64px] w-full rounded-lg border border-input bg-background px-2.5 py-2 text-sm shadow-sm"
              value={unpublishNote}
              onChange={(e) => setUnpublishNote(e.target.value)}
              placeholder="İç ekip notu (olay geçmişinde)"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setUnpublishOpen(false)} size="sm">
              Vazgeç
            </Button>
            <Button
              type="button"
              className="bg-amber-700 text-white hover:bg-amber-700/90"
              disabled={busyId !== null}
              onClick={() => void confirmUnpublish()}
              size="sm"
            >
              Kuyruğa al
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
