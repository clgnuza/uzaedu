'use client';

import { useEffect, useState } from 'react';
import { emitAdminMessagesUpdated } from '@/hooks/use-admin-messages-unread';
import { Megaphone, Check, Mail, ImageIcon, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

export function AdminMessageListSection({
  token,
  schoolId,
  refreshTrigger,
  canMarkRead = false,
}: {
  token: string | null;
  /** Superadmin: hangi okulun mesajları. School_admin: pass nothing (kendi okulu) */
  schoolId?: string | null;
  refreshTrigger?: number;
  /** Okundu işaretle butonu göster (sadece school_admin) */
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

  if (loading) return <LoadingSpinner label="Mesajlar yükleniyor…" className="py-8" />;
  if (error) return <p className="py-4 text-sm text-destructive">{error}</p>;
  if (!data?.items?.length)
    return (
      <EmptyState
        icon={<Megaphone />}
        title="Henüz sistem mesajı yok"
        description="Merkezden gönderilen mesajlar burada görünür."
      />
    );

  const unreadCount = data.items.filter((m) => !m.read_at).length;

  return (
    <div className="space-y-3">
      {canMarkRead && unreadCount > 0 && (
        <div className="rounded-xl border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-500/60 px-4 py-3">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
            {unreadCount} okunmamış mesaj var
          </p>
        </div>
      )}
      {data.items.map((m) => {
        const unread = !m.read_at;
        return (
          <Card
            key={m.id}
            className={cn(
              'cursor-pointer overflow-hidden transition-all hover:shadow-md',
              unread && 'ring-2 ring-amber-400/60 dark:ring-amber-500/40 shadow-lg',
            )}
            onClick={() => setDetailMessage(m)}
          >
            <CardHeader className={cn('pb-2', unread && 'bg-amber-50/50 dark:bg-amber-950/20')}>
              <div className="flex items-start gap-3">
                {m.image_url ? (
                  <img
                    src={m.image_url}
                    alt=""
                    className="size-14 shrink-0 rounded-lg object-cover border border-border"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <ImageIcon className="size-6 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                      {m.read_at ? (
                        <Check className="size-4 shrink-0 text-green-600" />
                      ) : (
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-amber-500">
                          <Mail className="size-3.5 text-white" />
                        </span>
                      )}
                      {m.title}
                      {unread && (
                        <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
                          YENİ
                        </span>
                      )}
                    </CardTitle>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {new Date(m.created_at).toLocaleString('tr-TR')}
                    {m.creator?.display_name && ` · ${m.creator.display_name}`}
                    {m.school && ` · ${m.school.name}`}
                  </p>
                  {m.body && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{m.body}</p>
                  )}
                </div>
              </div>
            </CardHeader>
            {!m.read_at && canMarkRead && (
              <div
                className="border-t border-border px-4 py-2.5 bg-muted/30"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => markRead(m.id)}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Okundu işaretle
                </button>
              </div>
            )}
          </Card>
        );
      })}
      <Dialog open={!!detailMessage} onOpenChange={(o) => !o && setDetailMessage(null)}>
        <DialogContent
          title={detailMessage?.title}
          className="max-w-2xl"
        >
          {detailMessage && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                <span>{new Date(detailMessage.created_at).toLocaleString('tr-TR')}</span>
                {detailMessage.creator?.display_name && (
                  <span>· {detailMessage.creator.display_name}</span>
                )}
                {detailMessage.school && <span>· {detailMessage.school.name}</span>}
              </div>
              {detailMessage.image_url && (
                <div className="rounded-xl overflow-hidden border border-border">
                  <img
                    src={detailMessage.image_url}
                    alt=""
                    className="w-full max-h-80 object-contain bg-muted"
                  />
                </div>
              )}
              {detailMessage.body && (
                <p className="whitespace-pre-wrap text-foreground">{detailMessage.body}</p>
              )}
              {!detailMessage.read_at && canMarkRead && (
                <div className="pt-2 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      markRead(detailMessage.id);
                      setDetailMessage({ ...detailMessage, read_at: new Date().toISOString() });
                    }}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    Okundu işaretle
                  </button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      {data.total > limit && (
        <p className="text-center text-xs text-muted-foreground">
          Toplam {data.total} mesaj (son {limit} gösteriliyor)
        </p>
      )}
    </div>
  );
}
