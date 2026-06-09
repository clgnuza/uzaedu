'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Alert } from '@/components/ui/alert';
import { PlanKatkiStatusBadge } from '@/components/bilsem/plan-katki-status-badge';
import {
  PlanKatkiWeekPreviewTable,
  parsePlanWeekItems,
} from '@/components/yillik-plan/plan-katki-week-preview-table';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  CheckCircle2,
  Clock,
  Eye,
  History,
  Inbox,
  RefreshCw,
  RotateCcw,
  Sparkles,
  XCircle,
} from 'lucide-react';

type QueueRow = {
  id: string;
  status: string;
  subjectCode: string;
  subjectLabel: string;
  grade: number;
  section: string | null;
  academicYear: string;
  tabloAltiNot: string | null;
  weekCount: number;
  submittedAt: string | null;
  updatedAt: string;
  createdAt: string;
  authorUserId: string;
  authorEmail: string | null;
  authorDisplayName: string | null;
};

type HistoryRow = QueueRow & {
  reviewerLabel: string | null;
  reviewNote: string | null;
  decidedAt: string | null;
  publishedAt: string | null;
};

type ModerationDashboard = {
  pending: number;
  published: number;
  rejected: number;
  withdrawn: number;
};

type SubmissionDetail = {
  id: string;
  itemsJson: string;
  subjectLabel: string;
  subjectCode: string;
  grade: number;
  section: string | null;
  academicYear: string;
  tabloAltiNot: string | null;
  status: string;
};

function fmtMod(iso: string | null | undefined) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '—';
  }
}

function authorLabel(r: QueueRow) {
  const name = r.authorDisplayName?.trim();
  if (name) return name;
  if (r.authorEmail) return r.authorEmail;
  return `${r.authorUserId.slice(0, 8)}…`;
}

function modListQs(applied: { year: string; q: string }) {
  const p = new URLSearchParams();
  if (applied.year) p.set('academic_year', applied.year);
  if (applied.q) p.set('q', applied.q);
  const s = p.toString();
  return s ? `?${s}` : '';
}

function PreviewPane({
  row,
  detail,
  loading,
  readOnly,
  onPublish,
  onReject,
  onClose,
  busy,
}: {
  row: QueueRow | null;
  detail: SubmissionDetail | null;
  loading: boolean;
  readOnly?: boolean;
  onPublish?: () => void;
  onReject?: () => void;
  onClose?: () => void;
  busy?: boolean;
}) {
  const items = useMemo(() => (detail ? parsePlanWeekItems(detail.itemsJson) : []), [detail]);

  if (!row) {
    return (
      <div className="flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-10 text-center">
        <Eye className="mb-2 h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm font-medium text-foreground">Önizleme</p>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
          Kuyruktan bir gönderi seçin; tüm haftalar tablo halinde burada görünür. Onay veya ret öncesi içeriği inceleyin.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-border bg-card shadow-sm">
      <div className="shrink-0 border-b border-border/70 bg-muted/30 px-3 py-2.5 sm:px-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Plan önizlemesi</p>
            <h3 className="mt-0.5 text-sm font-semibold leading-tight sm:text-base">
              {row.subjectLabel}{' '}
              <span className="font-normal text-muted-foreground">({row.subjectCode})</span>
            </h3>
            <p className="mt-1 text-[11px] text-muted-foreground sm:text-xs">
              {row.grade}. sınıf
              {row.section ? ` · ${row.section}` : ''} · {row.academicYear} · {row.weekCount} hafta
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Yazar: {authorLabel(row)}
              {row.submittedAt && (
                <span className="ml-1.5 inline-flex items-center gap-0.5">
                  · <Clock className="h-3 w-3" /> Gönderim {fmtMod(row.submittedAt)}
                </span>
              )}
            </p>
            {detail?.tabloAltiNot?.trim() && (
              <p className="mt-2 rounded-md border border-amber-500/25 bg-amber-500/8 px-2 py-1 text-[11px] text-amber-950 dark:text-amber-100">
                <span className="font-medium">Tablo altı not:</span> {detail.tabloAltiNot.trim()}
              </p>
            )}
          </div>
          {onClose && (
            <Button type="button" variant="ghost" size="sm" className="h-8 shrink-0 lg:hidden" onClick={onClose}>
              Kapat
            </Button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-2 pb-4 sm:p-3 sm:pb-5">
        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner label="Plan yükleniyor…" />
          </div>
        ) : (
          <PlanKatkiWeekPreviewTable items={items} />
        )}
      </div>

      {!readOnly && row.status === 'pending_review' && (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border/70 bg-muted/20 px-3 py-2.5 sm:px-4">
          <Button
            type="button"
            size="sm"
            variant="destructive"
            className="h-9"
            disabled={busy || loading || !items.length}
            onClick={onReject}
          >
            <XCircle className="mr-1.5 h-3.5 w-3.5" />
            Reddet
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-9 bg-emerald-600 hover:bg-emerald-600/90"
            disabled={busy || loading || !items.length}
            onClick={onPublish}
          >
            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
            Onayla ve yayınla
          </Button>
        </div>
      )}
    </div>
  );
}

export function PlanIcerikKatkiModerasyonPanel({ embedded = false }: { embedded?: boolean }) {
  const { token, me } = useAuth();
  const [rows, setRows] = useState<QueueRow[] | null>(null);
  const [historyRows, setHistoryRows] = useState<HistoryRow[] | null>(null);
  const [dashboard, setDashboard] = useState<ModerationDashboard | null>(null);
  const [view, setView] = useState<'queue' | 'history'>('queue');
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewRow, setPreviewRow] = useState<QueueRow | HistoryRow | null>(null);
  const [previewReadOnly, setPreviewReadOnly] = useState(false);
  const [previewDetail, setPreviewDetail] = useState<SubmissionDetail | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);

  const [publishOpen, setPublishOpen] = useState(false);
  const [publishNote, setPublishNote] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [unpublishOpen, setUnpublishOpen] = useState(false);
  const [unpublishRow, setUnpublishRow] = useState<HistoryRow | null>(null);
  const [unpublishNote, setUnpublishNote] = useState('');

  const [filterDraft, setFilterDraft] = useState({ year: '', q: '' });
  const [filterApplied, setFilterApplied] = useState({ year: '', q: '' });

  const selectedRow = useMemo(
    () => rows?.find((r) => r.id === selectedId) ?? null,
    [rows, selectedId],
  );

  const activePreviewRow = previewRow ?? selectedRow;

  const load = useCallback(async () => {
    if (!token) return;
    setErr(null);
    const fq = modListQs(filterApplied);
    try {
      const [data, dash] = await Promise.all([
        apiFetch<QueueRow[]>(`/yillik-plan-icerik/submissions/moderation/pending${fq}`, { token }),
        apiFetch<ModerationDashboard>('/yillik-plan-icerik/submissions/moderation/summary', { token }),
      ]);
      setRows(data);
      setDashboard(dash);
      setSelectedId((prev) => (prev && data.some((r) => r.id === prev) ? prev : data[0]?.id ?? null));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Liste alınamadı');
      setRows([]);
    }
  }, [token, filterApplied]);

  const loadHistory = useCallback(async () => {
    if (!token) return;
    const p = new URLSearchParams({ limit: '50' });
    if (filterApplied.year) p.set('academic_year', filterApplied.year);
    if (filterApplied.q) p.set('q', filterApplied.q);
    try {
      const h = await apiFetch<HistoryRow[]>(
        `/yillik-plan-icerik/submissions/moderation/history?${p.toString()}`,
        { token },
      );
      setHistoryRows(h);
    } catch {
      setHistoryRows([]);
    }
  }, [token, filterApplied]);

  const loadPreview = useCallback(
    async (id: string) => {
      if (!token) return;
      setPreviewLoading(true);
      setPreviewDetail(null);
      try {
        const d = await apiFetch<SubmissionDetail>(
          `/yillik-plan-icerik/submissions/moderation/${encodeURIComponent(id)}`,
          { token },
        );
        setPreviewDetail(d);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Önizleme yüklenemedi');
      } finally {
        setPreviewLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (view !== 'history' || !token) return;
    setHistoryRows(null);
    void loadHistory();
  }, [view, token, filterApplied, loadHistory]);

  useEffect(() => {
    if (!selectedId || view !== 'queue') return;
    setPreviewRow(selectedRow);
    setPreviewReadOnly(false);
    void loadPreview(selectedId);
  }, [selectedId, view, loadPreview, selectedRow]);

  function selectQueueRow(r: QueueRow) {
    setSelectedId(r.id);
    setPreviewRow(r);
    setPreviewReadOnly(false);
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
      setMobilePreviewOpen(true);
    }
  }

  async function confirmPublish() {
    const target = activePreviewRow;
    if (!token || !target || target.status !== 'pending_review') return;
    setBusyId(target.id);
    setErr(null);
    try {
      const res = await apiFetch<{ imported_weeks?: number }>(
        `/yillik-plan-icerik/submissions/moderation/${encodeURIComponent(target.id)}/publish`,
        {
          token,
          method: 'POST',
          body: JSON.stringify({ review_note: publishNote.trim() || null }),
        },
      );
      toast.success(`Yayınlandı (${res.imported_weeks ?? target.weekCount} hafta)`);
      setPublishOpen(false);
      setPublishNote('');
      setMobilePreviewOpen(false);
      setSelectedId(null);
      setPreviewDetail(null);
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

  async function confirmReject() {
    const target = activePreviewRow;
    if (!token || !target || target.status !== 'pending_review') return;
    setBusyId(target.id);
    setErr(null);
    try {
      await apiFetch(`/yillik-plan-icerik/submissions/moderation/${encodeURIComponent(target.id)}/reject`, {
        token,
        method: 'POST',
        body: JSON.stringify({ review_note: rejectNote.trim() || null }),
      });
      toast.success('Reddedildi');
      setRejectOpen(false);
      setRejectNote('');
      setMobilePreviewOpen(false);
      setSelectedId(null);
      setPreviewDetail(null);
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

  async function confirmUnpublish() {
    if (!token || !unpublishRow) return;
    setBusyId(unpublishRow.id);
    setErr(null);
    try {
      await apiFetch(
        `/yillik-plan-icerik/submissions/moderation/${encodeURIComponent(unpublishRow.id)}/unpublish`,
        {
          token,
          method: 'POST',
          body: JSON.stringify({ note: unpublishNote.trim() || null }),
        },
      );
      toast.success('Yayından kaldırıldı; kuyruğa alındı');
      setUnpublishOpen(false);
      setUnpublishRow(null);
      setUnpublishNote('');
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

  async function openHistoryPreview(r: HistoryRow) {
    setPreviewRow(r);
    setPreviewReadOnly(true);
    setMobilePreviewOpen(true);
    await loadPreview(r.id);
  }

  if (!me || (me.role !== 'superadmin' && me.role !== 'moderator')) return null;

  const nPending = rows?.length ?? 0;

  return (
    <div className={cn('space-y-3', embedded ? '' : 'mx-auto max-w-6xl px-3 pb-8 pt-1 sm:px-4')}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold tracking-tight sm:text-base">
            <Sparkles className="h-4 w-4 text-emerald-600" />
            MEB plan katkı moderasyonu
          </h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground sm:text-xs">
            Öğretmen katkılarını önce tam önizleyin, ardından kataloğa yayınlayın veya reddedin.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium sm:text-xs',
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

      {dashboard && (
        <div className="flex flex-wrap gap-1.5 text-[10px] sm:text-xs">
          {[
            { label: 'Bekleyen', n: dashboard.pending, cls: 'border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200' },
            { label: 'Yayınlanan', n: dashboard.published, cls: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200' },
            { label: 'Reddedilen', n: dashboard.rejected, cls: 'border-rose-500/30 bg-rose-500/10 text-rose-900 dark:text-rose-200' },
            { label: 'Geri çekilen', n: dashboard.withdrawn, cls: 'border-slate-400/30 bg-slate-500/10 text-slate-800 dark:text-slate-200' },
          ].map((s) => (
            <span key={s.label} className={cn('inline-flex items-center rounded-md border px-2 py-0.5 font-medium', s.cls)}>
              {s.label} {s.n}
            </span>
          ))}
        </div>
      )}

      <Alert variant="info" className="py-2.5 px-3">
        <p className="text-[11px] leading-snug text-muted-foreground sm:text-xs">
          <span className="font-medium text-foreground">İş akışı:</span> Kuyruktan satır seçin → sağda (veya mobilde) tüm haftaları inceleyin →{' '}
          <strong className="font-medium text-foreground">Onayla ve yayınla</strong> ile plan içeriği kataloğa yazılır.
          Geçmiş sekmesinde karar tarihi, inceleyen ve gerekçe görünür.
        </p>
      </Alert>

      <div className="flex max-w-md gap-1" role="tablist">
        {(
          [
            { id: 'queue' as const, label: 'İnceleme kuyruğu', Icon: Inbox },
            { id: 'history' as const, label: 'Karar geçmişi', Icon: History },
          ] as const
        ).map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={view === id}
            onClick={() => setView(id)}
            className={cn(
              'flex min-h-8 flex-1 items-center justify-center gap-1.5 rounded-md border px-2 text-xs font-medium transition-colors',
              view === id
                ? id === 'queue'
                  ? 'border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-200'
                  : 'border-violet-500/50 bg-violet-500/10 text-violet-900 dark:text-violet-200'
                : 'border-transparent bg-muted/50 text-muted-foreground hover:bg-muted/80',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-border/50 bg-card/50 p-2.5 sm:flex-row sm:items-end">
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="space-y-0.5">
            <Label className="text-[10px] text-muted-foreground">Öğretim yılı</Label>
            <Input
              className="h-8 text-xs"
              value={filterDraft.year}
              onChange={(e) => setFilterDraft((d) => ({ ...d, year: e.target.value }))}
              placeholder="ör. 2025-2026"
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
            onClick={() => setFilterApplied({ year: filterDraft.year.trim(), q: filterDraft.q.trim() })}
          >
            Filtrele
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => {
              setFilterDraft({ year: '', q: '' });
              setFilterApplied({ year: '', q: '' });
            }}
          >
            Sıfırla
          </Button>
        </div>
      </div>

      {err && (
        <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-xs text-rose-800 dark:text-rose-200">
          {err}
        </div>
      )}

      {view === 'history' ? (
        historyRows === null ? (
          <div className="flex justify-center py-10">
            <LoadingSpinner label="Geçmiş yükleniyor…" />
          </div>
        ) : historyRows.length === 0 ? (
          <div className="rounded-lg border border-dashed py-8 text-center text-xs text-muted-foreground">
            Yayınlanan veya reddedilen kayıt yok.
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {historyRows.map((r) => {
              const isPub = r.status === 'published';
              return (
                <li
                  key={r.id}
                  className={cn(
                    'border-l-4 px-3 py-2.5',
                    isPub ? 'border-l-emerald-500 bg-emerald-500/4' : 'border-l-rose-500 bg-rose-500/4',
                  )}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <PlanKatkiStatusBadge status={r.status} compact />
                        <span className="text-sm font-semibold">{r.subjectLabel}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {r.grade}. sınıf{r.section ? ` · ${r.section}` : ''} · {r.academicYear} · {r.weekCount} hafta ·{' '}
                        <code className="text-[10px]">{r.subjectCode}</code>
                      </p>
                      <p className="text-[11px] text-muted-foreground">Yazar: {authorLabel(r)}</p>
                      <p className="text-[11px]">
                        <Clock className="mr-0.5 inline h-3 w-3 opacity-60" />
                        Karar: <span className="font-medium">{fmtMod(r.decidedAt)}</span>
                        {r.publishedAt && (
                          <span className="text-muted-foreground"> · Katalog: {fmtMod(r.publishedAt)}</span>
                        )}
                        {r.submittedAt && (
                          <span className="text-muted-foreground"> · Gönderim: {fmtMod(r.submittedAt)}</span>
                        )}
                      </p>
                      {r.reviewerLabel && (
                        <p className="text-[11px] text-muted-foreground">İnceleyen: {r.reviewerLabel}</p>
                      )}
                      {r.reviewNote?.trim() && (
                        <p className="rounded-md border border-border/60 bg-muted/30 px-2 py-1 text-[11px] text-foreground">
                          <span className="font-medium text-muted-foreground">Not:</span> {r.reviewNote.trim()}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-1.5">
                      <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => void openHistoryPreview(r)}>
                        <Eye className="h-3.5 w-3.5" />
                        İçerik
                      </Button>
                      {isPub && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1 border-amber-600/40 text-amber-900 dark:text-amber-200"
                          disabled={busyId === r.id}
                          onClick={() => {
                            setUnpublishRow(r);
                            setUnpublishNote('');
                            setUnpublishOpen(true);
                          }}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Yayından kaldır
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )
      ) : rows === null ? (
        <div className="flex justify-center py-10">
          <LoadingSpinner label="Kuyruk yükleniyor…" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-amber-400/40 bg-amber-500/5 py-8 text-center">
          <p className="text-sm font-medium">Kuyruk boş</p>
          <p className="mt-1 text-xs text-muted-foreground">İncelenecek gönderi yok.</p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,340px)_1fr] lg:items-stretch">
          <ul className="divide-y divide-border rounded-lg border border-border bg-card lg:max-h-[min(72vh,720px)] lg:overflow-y-auto">
            {rows.map((r) => {
              const active = r.id === selectedId;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => selectQueueRow(r)}
                    className={cn(
                      'w-full border-l-4 px-3 py-2.5 text-left transition-colors',
                      active
                        ? 'border-l-sky-500 bg-sky-500/8'
                        : 'border-l-amber-500 bg-amber-500/4 hover:bg-muted/40',
                    )}
                  >
                    <p className="text-sm font-semibold leading-tight">{r.subjectLabel}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {r.grade}. sınıf{r.section ? ` · ${r.section}` : ''} · {r.academicYear}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {r.weekCount} hafta · {authorLabel(r)}
                    </p>
                    {r.submittedAt && (
                      <p className="mt-0.5 text-[10px] text-sky-800 dark:text-sky-200">Gönderim {fmtMod(r.submittedAt)}</p>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="hidden lg:flex lg:h-[min(72vh,720px)] lg:min-h-0 lg:flex-col">
            <PreviewPane
              row={selectedRow}
              detail={previewDetail}
              loading={previewLoading}
              busy={busyId === selectedRow?.id}
              onPublish={() => setPublishOpen(true)}
              onReject={() => setRejectOpen(true)}
            />
          </div>
        </div>
      )}

      <Dialog open={mobilePreviewOpen} onOpenChange={setMobilePreviewOpen}>
        <DialogContent
          title="Plan önizlemesi"
          scrollBody={false}
          className="max-w-4xl p-0"
          descriptionId="mob-pv"
        >
          <p id="mob-pv" className="sr-only">
            Gönderilen plan haftaları
          </p>
          <div className="flex min-h-0 flex-1 flex-col p-1 sm:p-2">
            <PreviewPane
              row={activePreviewRow}
              detail={previewDetail}
              loading={previewLoading}
              readOnly={previewReadOnly || activePreviewRow?.status !== 'pending_review'}
              busy={busyId === activePreviewRow?.id}
              onClose={() => setMobilePreviewOpen(false)}
              onPublish={() => setPublishOpen(true)}
              onReject={() => setRejectOpen(true)}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent title="Yayınla" descriptionId="pub-desc">
          <p id="pub-desc" className="text-xs text-muted-foreground">
            Bu gönderi onaylandığında aynı ders / sınıf / yıl için katalogdaki mevcut haftalar güncellenir.
          </p>
          {activePreviewRow && (
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
              {activePreviewRow.subjectLabel} · {activePreviewRow.grade}. sınıf · {activePreviewRow.weekCount} hafta
            </p>
          )}
          <div className="space-y-1.5">
            <Label>Moderasyon notu (opsiyonel)</Label>
            <textarea
              className="min-h-[72px] w-full rounded-lg border border-input bg-background px-2.5 py-2 text-sm"
              value={publishNote}
              onChange={(e) => setPublishNote(e.target.value)}
              placeholder="Yazar görebilir"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setPublishOpen(false)}>
              Vazgeç
            </Button>
            <Button
              type="button"
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-600/90"
              disabled={busyId !== null}
              onClick={() => void confirmPublish()}
            >
              Onayla ve yayınla
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent title="Reddet" descriptionId="rej-desc">
          <p id="rej-desc" className="text-xs text-muted-foreground">Katalog değişmez; gerekçe yazmanız önerilir.</p>
          {activePreviewRow && <p className="text-sm font-medium">{activePreviewRow.subjectLabel}</p>}
          <div className="space-y-1.5">
            <Label>Red gerekçesi</Label>
            <textarea
              className="min-h-[80px] w-full rounded-lg border border-input bg-background px-2.5 py-2 text-sm"
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="Eksik hafta, format hatası vb."
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setRejectOpen(false)}>
              Vazgeç
            </Button>
            <Button type="button" variant="destructive" size="sm" disabled={busyId !== null} onClick={() => void confirmReject()}>
              Reddet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={unpublishOpen} onOpenChange={setUnpublishOpen}>
        <DialogContent title="Yayından kaldır" descriptionId="unpub-desc">
          <p id="unpub-desc" className="text-xs text-muted-foreground">
            Katalogdaki bu gönderiye ait haftalar silinir; kayıt inceleme kuyruğuna döner.
          </p>
          {unpublishRow && <p className="text-sm font-medium">{unpublishRow.subjectLabel}</p>}
          <div className="space-y-1.5">
            <Label>Not (opsiyonel)</Label>
            <textarea
              className="min-h-[64px] w-full rounded-lg border border-input bg-background px-2.5 py-2 text-sm"
              value={unpublishNote}
              onChange={(e) => setUnpublishNote(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => setUnpublishOpen(false)}>
              Vazgeç
            </Button>
            <Button
              type="button"
              size="sm"
              className="bg-amber-700 text-white hover:bg-amber-700/90"
              disabled={busyId !== null}
              onClick={() => void confirmUnpublish()}
            >
              Kuyruğa al
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
