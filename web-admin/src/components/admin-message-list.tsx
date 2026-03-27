'use client';

import { useEffect, useState } from 'react';
import { emitAdminMessagesUpdated } from '@/hooks/use-admin-messages-unread';
import { Building2, CheckCircle2, ChevronRight, Inbox, Megaphone, Sparkles, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { Dialog, DialogContent } from '@/components/ui/dialog';

export type AdminMessageItem = {
  id: string;
  title: string;
  body: string | null;
  image_url?: string | null;
  created_at: string;
  read_at: string | null;
  creator?: { display_name: string | null; email: string } | null;
  school?: { name: string } | null;
};

type ListResponse = { total: number; page: number; limit: number; items: AdminMessageItem[] };

function formatRelativeTr(iso: string): string {
  const d = new Date(iso);
  const t = d.getTime();
  if (Number.isNaN(t)) return '';
  const diffMs = Date.now() - t;
  const sec = Math.floor(diffMs / 1000);
  if (sec < 45) return 'Az önce';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} dk önce`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs} saat önce`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} gün önce`;
  if (days < 30) return `${Math.floor(days / 7)} hafta önce`;
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatFullDateTime(iso: string): string {
  return new Date(iso).toLocaleString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AdminMessageListSection({
  token,
  schoolId,
  refreshTrigger,
  canMarkRead = false,
}: {
  token: string | null;
  schoolId?: string | null;
  refreshTrigger?: number;
  canMarkRead?: boolean;
}) {
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailMessage, setDetailMessage] = useState<AdminMessageItem | null>(null);
  const limit = 50;

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: '1', limit: String(limit) });
    if (schoolId != null && schoolId !== '') params.set('school_id', schoolId);
    apiFetch<ListResponse>(`/admin-messages?${params}`, { token })
      .then(setData)
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Liste yüklenemedi');
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [token, schoolId, refreshTrigger]);

  const markRead = async (id: string) => {
    if (!token) return;
    try {
      await apiFetch(`/admin-messages/${id}/read`, { method: 'PATCH', token });
      setData((prev) =>
        prev
          ? { ...prev, items: prev.items.map((m) => (m.id === id ? { ...m, read_at: new Date().toISOString() } : m)) }
          : null,
      );
      emitAdminMessagesUpdated();
    } catch {
      // ignore
    }
  };

  if (loading) return <LoadingSpinner label="Mesajlar yükleniyor…" className="py-12" />;
  if (error) return <p className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>;
  if (!data?.items?.length)
    return (
      <EmptyState
        icon={<Inbox className="size-8" />}
        title="Henüz mesaj yok"
        description="Öğretmen Pro yönetiminden okulunuza gönderilen sistem ve bilgilendirme mesajları burada görünür. Duyuru TV veya sınıf duyurularından bağımsızdır."
      />
    );

  const unreadCount = data.items.filter((m) => !m.read_at).length;

  return (
    <div className="space-y-5">
      {canMarkRead && unreadCount > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-sky-200/80 bg-sky-50/90 px-4 py-3.5 dark:border-sky-500/20 dark:bg-sky-950/35">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-100/90 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300">
            <Sparkles className="size-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{unreadCount} okunmamış mesaj</p>
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Mesaja tıklayıp okuyun; «Okundu işaretle» ile listede işaretleyin.
            </p>
          </div>
        </div>
      )}

      <ul className="space-y-3" aria-label="Sistem mesajları listesi">
        {data.items.map((m) => {
          const unread = !m.read_at;
          return (
            <li key={m.id}>
              <div
                className={cn(
                  'overflow-hidden rounded-2xl border transition-colors duration-200',
                  unread
                    ? 'border-sky-200/90 bg-sky-50/70 shadow-sm dark:border-sky-500/25 dark:bg-sky-950/30'
                    : 'border-slate-200/80 bg-slate-50/80 dark:border-slate-700/60 dark:bg-slate-900/40',
                )}
              >
                <button
                  type="button"
                  onClick={() => setDetailMessage(m)}
                  className={cn(
                    'group w-full text-left transition-colors duration-200',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                    unread
                      ? 'hover:bg-sky-100/50 dark:hover:bg-sky-950/45'
                      : 'hover:bg-slate-100/80 dark:hover:bg-slate-900/55',
                  )}
                >
                  <div className="flex gap-3 p-4 sm:gap-4">
                  <div className="relative shrink-0">
                    {m.image_url ? (
                      <img
                        src={m.image_url}
                        alt=""
                        className="size-[72px] rounded-xl border border-slate-200/90 object-cover shadow-sm dark:border-slate-600/50 sm:size-20"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div
                        className={cn(
                          'flex size-[72px] items-center justify-center rounded-xl border sm:size-20',
                          unread
                            ? 'border-sky-200/80 bg-sky-100/60 text-sky-600 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300'
                            : 'border-slate-200/70 bg-slate-100/70 text-slate-500 dark:border-slate-600/50 dark:bg-slate-800/50 dark:text-slate-400',
                        )}
                      >
                        <Megaphone className="size-8 opacity-90" strokeWidth={1.75} aria-hidden />
                      </div>
                    )}
                    {unread && (
                      <span
                        className="absolute -right-1 -top-1 flex size-3 rounded-full border-2 border-sky-50 bg-sky-500 shadow-sm dark:border-sky-950 dark:bg-sky-400"
                        title="Okunmadı"
                      />
                    )}
                  </div>

                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex flex-wrap items-center gap-2 gap-y-1">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                          unread
                            ? 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200'
                            : 'bg-slate-200/70 text-slate-600 dark:bg-slate-700/80 dark:text-slate-300',
                        )}
                      >
                        Merkez
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400" title={formatFullDateTime(m.created_at)}>
                        {formatRelativeTr(m.created_at)}
                      </span>
                      <span className="hidden text-xs text-slate-400 dark:text-slate-500 sm:inline">·</span>
                      <span className="hidden text-xs text-slate-500 dark:text-slate-400 sm:inline">{formatFullDateTime(m.created_at)}</span>
                      {m.read_at && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100/90 px-2 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
                          <CheckCircle2 className="size-3" aria-hidden />
                          Okundu
                        </span>
                      )}
                    </div>
                    <h3
                      className={cn(
                        'mt-1.5 line-clamp-2 text-start text-base font-semibold leading-snug tracking-tight text-slate-900 dark:text-slate-50',
                        !unread && 'font-medium text-slate-800 dark:text-slate-100',
                      )}
                    >
                      {m.title}
                    </h3>
                    {m.body && (
                      <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{m.body}</p>
                    )}
                    {m.creator?.display_name && (
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                        <User className="size-3.5 shrink-0 opacity-80" aria-hidden />
                        <span>{m.creator.display_name}</span>
                      </p>
                    )}
                    {m.school && (
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                        <Building2 className="size-3.5 shrink-0 opacity-80" aria-hidden />
                        {m.school.name}
                      </p>
                    )}
                  </div>

                  <ChevronRight
                    className="mt-1 size-5 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-400 dark:text-slate-600 dark:group-hover:text-slate-500"
                    aria-hidden
                  />
                </div>
                </button>

                {!m.read_at && canMarkRead && (
                  <div className="flex border-t border-sky-100/90 bg-sky-50/50 px-4 py-2.5 dark:border-sky-500/15 dark:bg-sky-950/25">
                    <button
                      type="button"
                      onClick={() => markRead(m.id)}
                      className="text-sm font-medium text-sky-700 underline-offset-4 hover:text-sky-800 hover:underline dark:text-sky-300 dark:hover:text-sky-200"
                    >
                      Okundu işaretle
                    </button>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <Dialog open={!!detailMessage} onOpenChange={(o) => !o && setDetailMessage(null)}>
        <DialogContent title={detailMessage?.title ?? ''} className="max-w-2xl">
          {detailMessage && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-800 dark:bg-sky-500/20 dark:text-sky-200">
                  Merkez
                </span>
                <span className="text-slate-600 dark:text-slate-300">{formatFullDateTime(detailMessage.created_at)}</span>
                <span className="text-xs text-slate-500">({formatRelativeTr(detailMessage.created_at)})</span>
              </div>

              {detailMessage.creator?.display_name && (
                <p className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <User className="size-4 shrink-0 opacity-90" aria-hidden />
                  <span>Gönderen: {detailMessage.creator.display_name}</span>
                </p>
              )}

              {detailMessage.image_url && (
                <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-slate-50/80 dark:border-slate-600/50 dark:bg-slate-900/40">
                  <img
                    src={detailMessage.image_url}
                    alt=""
                    className="max-h-[min(320px,50vh)] w-full object-contain"
                  />
                </div>
              )}

              {detailMessage.body ? (
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/90 px-4 py-4 dark:border-slate-600/40 dark:bg-slate-900/35">
                  <p className="whitespace-pre-wrap text-[15px] leading-[1.65] text-slate-800 dark:text-slate-100">{detailMessage.body}</p>
                </div>
              ) : (
                <p className="text-sm italic text-slate-500 dark:text-slate-400">Ek metin yok.</p>
              )}

              {!detailMessage.read_at && canMarkRead && (
                <div className="flex flex-wrap items-center gap-3 border-t border-slate-200/80 pt-4 dark:border-slate-700/60">
                  <Button
                    type="button"
                    variant="secondary"
                    className="bg-sky-100 text-sky-900 hover:bg-sky-200/90 dark:bg-sky-500/20 dark:text-sky-100 dark:hover:bg-sky-500/30"
                    onClick={() => {
                      markRead(detailMessage.id);
                      setDetailMessage({ ...detailMessage, read_at: new Date().toISOString() });
                    }}
                  >
                    Okundu işaretle
                  </Button>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Liste ve bildirim sayacı güncellenir.</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {data.total > limit && (
        <p className="text-center text-xs text-muted-foreground">
          Toplam {data.total} mesaj — son {limit} kayıt gösteriliyor
        </p>
      )}
    </div>
  );
}
