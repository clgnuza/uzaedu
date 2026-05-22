'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Recipient,
  STATUS_COLORS,
  STATUS_LABELS,
  fetchRecipientPdfBlob,
  PDF_CAMPAIGN_TYPES,
} from '@/lib/messaging-api';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import {
  Pencil,
  Check,
  X,
  LayoutGrid,
  List,
  Search,
  ChevronLeft,
  ChevronRight,
  FileText,
  Eye,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import MessageBubblePreview from './MessageBubblePreview';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Props {
  campaignId: string;
  campaignType?: string;
  recipients: Recipient[];
  token: string | null | undefined;
  q: string;
  onChange?: () => void;
  enablePdfPreview?: boolean;
}

const PAGE = 25;

export default function CampaignPreviewTable({
  campaignId,
  campaignType,
  recipients,
  token,
  q,
  onChange,
  enablePdfPreview,
}: Props) {
  const pdfMode =
    enablePdfPreview ??
    (campaignType ? PDF_CAMPAIGN_TYPES.has(campaignType) : false);

  const [view, setView] = useState<'table' | 'cards'>('cards');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [editId, setEditId] = useState<string | null>(null);
  const [editPhone, setEditPhone] = useState('');
  const [editMsg, setEditMsg] = useState('');
  const [detail, setDetail] = useState<Recipient | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const filtered = useMemo(() => {
    const qn = query.trim().toLowerCase();
    if (!qn) return recipients;
    return recipients.filter((r) => {
      const hay = [
        r.recipientName,
        r.phone,
        r.studentName,
        r.className,
        r.messageText,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(qn);
    });
  }, [recipients, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const slice = filtered.slice(page * PAGE, page * PAGE + PAGE);

  useEffect(() => {
    setPage(0);
  }, [query]);

  const startEdit = (r: Recipient) => {
    setEditId(r.id);
    setEditPhone(r.phone ?? '');
    setEditMsg(r.messageText ?? '');
  };

  const saveEdit = async () => {
    if (!editId) return;
    try {
      await apiFetch(`/messaging/recipients/${editId}${q}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ phone: editPhone, messageText: editMsg }),
      });
      toast.success('Güncellendi');
      setEditId(null);
      onChange?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Hata');
    }
  };

  const openDetail = (r: Recipient) => {
    setDetail(r);
    setPdfUrl(null);
  };

  const loadPdf = useCallback(async () => {
    if (!detail || !token || !pdfMode) return;
    if (!detail.hasFile) {
      toast.error('Bu alıcı için ayrı PDF yok');
      return;
    }
    setPdfLoading(true);
    try {
      const blob = await fetchRecipientPdfBlob(token, campaignId, detail.id, q);
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'PDF yüklenemedi');
    } finally {
      setPdfLoading(false);
    }
  }, [detail, token, campaignId, q, pdfMode]);

  useEffect(() => {
    if (detail && pdfMode && detail.hasFile) void loadPdf();
  }, [detail?.id, pdfMode, loadPdf]);

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  const closeDetail = () => {
    setDetail(null);
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Ad, telefon, öğrenci ara…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 pl-8 text-sm"
          />
        </div>
        <div className="flex rounded-lg border bg-white/80 p-0.5 dark:bg-zinc-900/60">
          <button
            type="button"
            onClick={() => setView('cards')}
            className={cn(
              'rounded-md p-1.5',
              view === 'cards' ? 'bg-indigo-600 text-white' : 'text-muted-foreground',
            )}
            aria-label="Kart görünümü"
          >
            <LayoutGrid className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setView('table')}
            className={cn(
              'rounded-md p-1.5',
              view === 'table' ? 'bg-indigo-600 text-white' : 'text-muted-foreground',
            )}
            aria-label="Tablo görünümü"
          >
            <List className="size-4" />
          </button>
        </div>
        <span className="text-xs text-muted-foreground">
          {filtered.length} / {recipients.length}
        </span>
      </div>

      {view === 'cards' ? (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {slice.map((r, i) => (
            <RecipientCard
              key={r.id}
              index={page * PAGE + i + 1}
              r={r}
              editing={editId === r.id}
              editPhone={editPhone}
              editMsg={editMsg}
              onEditPhone={setEditPhone}
              onEditMsg={setEditMsg}
              onStartEdit={() => startEdit(r)}
              onSave={saveEdit}
              onCancel={() => setEditId(null)}
              onOpen={() => openDetail(r)}
              showPdfBadge={pdfMode && !!r.hasFile}
            />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-white/70 dark:bg-zinc-900/50">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-slate-50 dark:bg-zinc-800/60">
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground">#</th>
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Ad</th>
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Telefon</th>
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Öğrenci</th>
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Mesaj</th>
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Durum</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {slice.map((r, i) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-slate-50/60 dark:hover:bg-zinc-800/30">
                  <td className="px-3 py-2 text-muted-foreground">{page * PAGE + i + 1}</td>
                  <td className="px-3 py-2 font-medium">{r.recipientName ?? '—'}</td>
                  <td className="px-3 py-2">
                    {editId === r.id ? (
                      <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="h-7 w-36 text-xs" />
                    ) : (
                      <span className={cn(!r.phone && 'font-semibold text-red-500')}>{r.phone ?? '⚠ yok'}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {r.studentName ? `${r.studentName}${r.className ? ` / ${r.className}` : ''}` : '—'}
                  </td>
                  <td className="max-w-[200px] px-3 py-2">
                    {editId === r.id ? (
                      <Input value={editMsg} onChange={(e) => setEditMsg(e.target.value)} className="h-7 text-xs" />
                    ) : (
                      <span className="line-clamp-2 text-muted-foreground">{r.messageText ?? '—'}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={r.status} error={r.errorMsg} />
                  </td>
                  <td className="px-2 py-2">
                    <RowActions
                      editing={editId === r.id}
                      onSave={saveEdit}
                      onCancel={() => setEditId(null)}
                      onEdit={() => startEdit(r)}
                      onView={() => openDetail(r)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Sonuç yok</p>
      ) : null}

      {totalPages > 1 ? (
        <div className="flex items-center justify-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 0} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-xs text-muted-foreground">
            {page + 1} / {totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      ) : null}

      <Dialog open={!!detail} onOpenChange={(o) => !o && closeDetail()}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto sm:max-w-2xl">
          {detail ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-base">
                  {detail.recipientName ?? 'Alıcı'} — mesaj önizleme
                </DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2 text-xs">
                  <p>
                    <span className="font-semibold text-muted-foreground">Telefon:</span>{' '}
                    {detail.phone ?? '—'}
                  </p>
                  {detail.studentName ? (
                    <p>
                      <span className="font-semibold text-muted-foreground">Öğrenci:</span>{' '}
                      {detail.studentName}
                      {detail.className ? ` (${detail.className})` : ''}
                    </p>
                  ) : null}
                  <StatusBadge status={detail.status} error={detail.errorMsg} />
                </div>
                <MessageBubblePreview
                  text={detail.messageText ?? ''}
                  attachmentLabel={
                    pdfMode && detail.hasFile ? 'ek_belge.pdf' : null
                  }
                />
              </div>
              {pdfMode && detail.hasFile ? (
                <div className="rounded-xl border bg-slate-50/80 p-2 dark:bg-zinc-900/50">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1 text-xs font-semibold">
                      <FileText className="size-3.5" />
                      PDF ek önizleme
                    </span>
                    <Button size="sm" variant="outline" className="h-7 text-xs" disabled={pdfLoading} onClick={() => void loadPdf()}>
                      {pdfLoading ? '…' : 'Yenile'}
                    </Button>
                  </div>
                  {pdfUrl ? (
                    <iframe title="PDF önizleme" src={pdfUrl} className="h-[min(50vh,360px)] w-full rounded-lg border bg-white" />
                  ) : (
                    <p className="py-6 text-center text-xs text-muted-foreground">
                      {pdfLoading ? 'PDF yükleniyor…' : 'PDF yüklenemedi'}
                    </p>
                  )}
                </div>
              ) : null}
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status, error }: { status: string; error?: string | null }) {
  return (
    <div>
      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', STATUS_COLORS[status])}>
        {STATUS_LABELS[status] ?? status}
      </span>
      {error ? <p className="mt-0.5 line-clamp-2 text-[10px] text-red-500">{error}</p> : null}
    </div>
  );
}

function RowActions({
  editing,
  onSave,
  onCancel,
  onEdit,
  onView,
}: {
  editing: boolean;
  onSave: () => void;
  onCancel: () => void;
  onEdit: () => void;
  onView: () => void;
}) {
  if (editing) {
    return (
      <div className="flex gap-1">
        <button type="button" onClick={onSave} className="rounded p-1 text-green-600 hover:bg-green-50">
          <Check className="size-3.5" />
        </button>
        <button type="button" onClick={onCancel} className="rounded p-1 text-red-500 hover:bg-red-50">
          <X className="size-3.5" />
        </button>
      </div>
    );
  }
  return (
    <div className="flex gap-1">
      <button type="button" onClick={onView} className="rounded p-1 text-indigo-600 hover:bg-indigo-50" title="Önizle">
        <Eye className="size-3.5" />
      </button>
      <button type="button" onClick={onEdit} className="rounded p-1 text-muted-foreground hover:bg-slate-100 dark:hover:bg-zinc-700">
        <Pencil className="size-3.5" />
      </button>
    </div>
  );
}

function RecipientCard({
  r,
  index,
  editing,
  editPhone,
  editMsg,
  onEditPhone,
  onEditMsg,
  onStartEdit,
  onSave,
  onCancel,
  onOpen,
  showPdfBadge,
}: {
  r: Recipient;
  index: number;
  editing: boolean;
  editPhone: string;
  editMsg: string;
  onEditPhone: (v: string) => void;
  onEditMsg: (v: string) => void;
  onStartEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onOpen: () => void;
  showPdfBadge: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border bg-white/90 p-3 shadow-sm transition-shadow hover:shadow-md dark:bg-zinc-900/70',
        !r.phone && 'border-amber-300/80 dark:border-amber-800/50',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold text-muted-foreground">#{index}</p>
          <p className="text-sm font-semibold">{r.recipientName ?? '—'}</p>
          <p className={cn('text-xs', !r.phone && 'font-semibold text-amber-700 dark:text-amber-300')}>
            {r.phone ?? 'Telefon eksik'}
          </p>
        </div>
        <StatusBadge status={r.status} />
      </div>
      {r.studentName ? (
        <p className="mt-1 text-[11px] text-muted-foreground">
          {r.studentName}
          {r.className ? ` · ${r.className}` : ''}
        </p>
      ) : null}
      {editing ? (
        <div className="mt-2 space-y-1.5">
          <Input value={editPhone} onChange={(e) => onEditPhone(e.target.value)} className="h-8 text-xs" placeholder="Telefon" />
          <textarea
            value={editMsg}
            onChange={(e) => onEditMsg(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-input bg-white px-2 py-1 text-xs dark:bg-zinc-900"
          />
          <div className="flex gap-1">
            <Button size="sm" className="h-7 flex-1" onClick={onSave}>
              Kaydet
            </Button>
            <Button size="sm" variant="outline" className="h-7" onClick={onCancel}>
              İptal
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-2 line-clamp-3 text-[11px] leading-relaxed text-muted-foreground whitespace-pre-line">
            {r.messageText ?? '—'}
          </p>
          {showPdfBadge ? (
            <span className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200">
              <FileText className="size-3" />
              PDF ek
            </span>
          ) : null}
          <div className="mt-2 flex gap-1">
            <Button size="sm" variant="outline" className="h-7 flex-1 gap-1 text-xs" onClick={onOpen}>
              <Eye className="size-3" />
              Tam önizle
            </Button>
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={onStartEdit}>
              <Pencil className="size-3.5" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
