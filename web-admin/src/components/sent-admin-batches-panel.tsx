'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Loader2,
  Trash2,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';

type SentBatchRow = {
  batch_id: string;
  title: string;
  body: string | null;
  image_url: string | null;
  created_at: string;
  school_count: number;
  read_count: number;
  creator: { display_name: string | null; email: string } | null;
};

type ListResponse = { total: number; page: number; limit: number; items: SentBatchRow[] };

type DeliverySchool = {
  school_id: string;
  school_name: string;
  city: string | null;
  district: string | null;
  message_id: string;
  read_at: string | null;
};

type DeliveryReport = {
  batch_id: string;
  title: string;
  body: string | null;
  image_url: string | null;
  created_at: string;
  school_count: number;
  read_count: number;
  creator: { display_name: string | null; email: string } | null;
  schools: DeliverySchool[];
};

const PAGE_SIZE = 15;

function bodyPreview(body: string | null, max = 72): string {
  if (!body?.trim()) return '—';
  const t = body.replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

export function SentAdminBatchesPanel({
  token,
  refreshTrigger,
}: {
  token: string | null;
  refreshTrigger: number;
}) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [report, setReport] = useState<DeliveryReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadList = useCallback(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    apiFetch<ListResponse>(`/admin-messages/sent-batches?page=${page}&limit=${PAGE_SIZE}`, { token })
      .then(setData)
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Liste yüklenemedi');
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [token, page, refreshTrigger]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    if (!detailId || !token) return;
    setReportLoading(true);
    setReport(null);
    apiFetch<DeliveryReport>(`/admin-messages/sent-batches/${detailId}/report`, { token })
      .then(setReport)
      .catch(() => setReport(null))
      .finally(() => setReportLoading(false));
  }, [detailId, token]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / (data.limit || PAGE_SIZE))) : 1;

  const handleDelete = async (row: SentBatchRow) => {
    if (!token) return;
    const ok = window.confirm(
      `"${row.title}" gönderimini silmek istediğinize emin misiniz? Bu gönderimdeki tüm okulların mesajları kalıcı olarak silinir; geri alınamaz.`,
    );
    if (!ok) return;
    setDeletingId(row.batch_id);
    try {
      await apiFetch<{ deleted: number }>(`/admin-messages/sent-batches/${row.batch_id}`, {
        method: 'DELETE',
        token,
      });
      if (detailId === row.batch_id) setDetailId(null);
      if (data?.items.length === 1 && page > 1) setPage((p) => Math.max(1, p - 1));
      else void loadList();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Silinemedi');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <Card className="overflow-hidden border-border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
            <BarChart3 className="size-5 shrink-0" />
            Gönderilen mesajlar
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Toplu gönderimler tabloda listelenir. Satıra tıklayınca okul bazlı iletim özeti açılır. Silinen gönderim tüm
            okullardan kaldırılır.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <LoadingSpinner label="Gönderimler yükleniyor…" className="py-8" />
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : !data?.items?.length ? (
            <EmptyState
              icon={<BarChart3 className="size-8" />}
              title="Henüz gönderim yok"
              description="Yeni mesaj gönderdiğinizde burada görünür."
            />
          ) : (
            <>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <th className="whitespace-nowrap px-3 py-2.5">Tarih</th>
                      <th className="px-3 py-2.5">Başlık</th>
                      <th className="hidden lg:table-cell px-3 py-2.5">Özet</th>
                      <th className="whitespace-nowrap px-3 py-2.5 text-center">Okul</th>
                      <th className="whitespace-nowrap px-3 py-2.5 text-center">Okundu</th>
                      <th className="w-px px-2 py-2.5" aria-hidden />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.items.map((row) => {
                      const unread = row.school_count - row.read_count;
                      return (
                        <tr key={row.batch_id} className="bg-background transition-colors hover:bg-muted/30">
                          <td className="whitespace-nowrap px-3 py-2.5 align-middle text-xs text-muted-foreground">
                            {new Date(row.created_at).toLocaleString('tr-TR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="max-w-[220px] px-3 py-2.5 align-middle">
                            <button
                              type="button"
                              onClick={() => setDetailId(row.batch_id)}
                              className="w-full text-left font-medium text-foreground hover:text-primary"
                            >
                              <span className="line-clamp-2">{row.title}</span>
                              {row.creator?.display_name && (
                                <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">
                                  {row.creator.display_name}
                                </span>
                              )}
                            </button>
                          </td>
                          <td className="hidden max-w-[280px] px-3 py-2.5 align-middle lg:table-cell">
                            <span className="line-clamp-2 text-xs text-muted-foreground">{bodyPreview(row.body)}</span>
                          </td>
                          <td className="px-3 py-2.5 text-center align-middle">
                            <span className="inline-flex min-w-8 justify-center rounded-md bg-muted/80 px-1.5 py-0.5 text-xs font-medium tabular-nums">
                              {row.school_count}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 align-middle">
                            <div className="flex flex-col items-center gap-0.5 text-xs">
                              <span className="font-medium text-emerald-700 dark:text-emerald-400">{row.read_count}</span>
                              {unread > 0 && (
                                <span className="text-[10px] text-amber-700 dark:text-amber-300">{unread} bekliyor</span>
                              )}
                            </div>
                          </td>
                          <td className="px-2 py-2 align-middle">
                            <div className="flex items-center gap-0.5">
                              <button
                                type="button"
                                onClick={() => setDetailId(row.batch_id)}
                                className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                                aria-label="Detay"
                              >
                                <ChevronRight className="size-4" />
                              </button>
                              <button
                                type="button"
                                disabled={deletingId === row.batch_id}
                                onClick={() => handleDelete(row)}
                                className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                                aria-label="Gönderimi sil"
                              >
                                {deletingId === row.batch_id ? (
                                  <Loader2 className="size-4 animate-spin" />
                                ) : (
                                  <Trash2 className="size-4" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {data.total > PAGE_SIZE && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
                  <span>
                    Toplam <span className="font-medium text-foreground">{data.total}</span> gönderim · Sayfa{' '}
                    <span className="font-medium text-foreground">{page}</span> / {totalPages}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronLeft className="size-3.5" />
                      Önceki
                    </button>
                    <button
                      type="button"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                      className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Sonraki
                      <ChevronRight className="size-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent title="İletim raporu" className="max-w-3xl">
          {reportLoading && (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Rapor yükleniyor…
            </div>
          )}
          {!reportLoading && report && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3 text-sm">
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
                  {report.school_count} okul
                </span>
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:text-emerald-300">
                  {report.read_count} okundu
                </span>
                <span className="text-muted-foreground">
                  {new Date(report.created_at).toLocaleString('tr-TR')}
                </span>
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">{report.title}</h3>
                {report.body && (
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{report.body}</p>
                )}
                {report.image_url && (
                  <div className="mt-3 overflow-hidden rounded-lg border border-border">
                    <img src={report.image_url} alt="" className="max-h-56 w-full object-contain" />
                  </div>
                )}
              </div>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[320px] text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left text-xs font-medium text-muted-foreground">
                      <th className="px-3 py-2">Okul</th>
                      <th className="px-3 py-2">İl / İlçe</th>
                      <th className="px-3 py-2">Okundu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.schools.map((s) => (
                      <tr key={s.message_id} className="border-b border-border/60 last:border-0">
                        <td className="px-3 py-2 font-medium text-foreground">{s.school_name}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {[s.city, s.district].filter(Boolean).join(' / ') || '—'}
                        </td>
                        <td className="px-3 py-2">
                          {s.read_at ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                              <CheckCircle2 className="size-3.5 shrink-0" />
                              {new Date(s.read_at).toLocaleString('tr-TR')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-muted-foreground">
                              <Circle className="size-3.5 shrink-0 opacity-50" />
                              Bekliyor
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {!reportLoading && !report && detailId && (
            <p className="py-4 text-sm text-destructive">Rapor yüklenemedi.</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
