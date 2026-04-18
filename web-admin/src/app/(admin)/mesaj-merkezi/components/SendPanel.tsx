'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Campaign,
  executeCampaign,
  getDeliveryHint,
  loadRecipients,
  retryFailedCampaign,
  abortCampaignSend,
  STATUS_COLORS,
  STATUS_LABELS,
  type Recipient,
} from '@/lib/messaging-api';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';
import { Send, CheckCircle2, XCircle, Clock, OctagonAlert, RotateCcw, StopCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import ManualWhatsappSendPanel from './ManualWhatsappSendPanel';

interface Props {
  campaign: Campaign;
  token: string | null | undefined;
  q: string;
  onSent?: () => void;
}

export default function SendPanel({ campaign, token, q, onSent }: Props) {
  const [sending, setSending] = useState(false);
  const [linkMode, setLinkMode] = useState<boolean | null>(null);
  const [failedRows, setFailedRows] = useState<Recipient[]>([]);
  const [failOpen, setFailOpen] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [aborting, setAborting] = useState(false);

  useEffect(() => {
    if (!token) return;
    void getDeliveryHint(token, q)
      .then((h) => setLinkMode(h.whatsappLinkMode))
      .catch(() => setLinkMode(false));
  }, [token, q]);

  const loadFailures = useCallback(async () => {
    if (!token || campaign.failedCount <= 0) {
      setFailedRows([]);
      return;
    }
    try {
      const all = await loadRecipients(token, campaign.id, q);
      setFailedRows(all.filter((r) => r.status === 'failed'));
    } catch {
      setFailedRows([]);
    }
  }, [token, campaign.id, campaign.failedCount, q]);

  useEffect(() => {
    if (linkMode !== false || campaign.failedCount <= 0) return;
    void loadFailures();
  }, [linkMode, campaign.failedCount, campaign.id, loadFailures]);

  const send = async () => {
    if (!confirm(`"${campaign.title}" kampanyasındaki ${campaign.totalCount} kişiye mesaj gönderilecek. Devam?`)) return;
    setSending(true);
    try {
      const res = await executeCampaign(token ?? '', campaign.id, q);
      toast.success(`Gönderim başladı — ${res.total} alıcı`);
      onSent?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Hata');
    } finally {
      setSending(false);
    }
  };

  const pct = campaign.totalCount > 0 ? Math.round((campaign.sentCount / campaign.totalCount) * 100) : 0;
  const showManual =
    linkMode && (campaign.status === 'preview' || campaign.status === 'failed' || campaign.status === 'sending');

  const retryFailed = async () => {
    if (!token) return;
    if (!confirm(`${campaign.failedCount} başarısız alıcı yeniden kuyruğa alınsın mı?`)) return;
    setRetrying(true);
    try {
      const res = await retryFailedCampaign(token, campaign.id, q);
      toast.success(`Yeniden gönderim başladı — ${res.total} alıcı`);
      onSent?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Hata');
    } finally {
      setRetrying(false);
    }
  };

  const abortSend = async () => {
    if (!token) return;
    if (!confirm('Gönderimi durdurmak istediğinize emin misiniz? (Bir sonraki alıcıdan önce durur.)')) return;
    setAborting(true);
    try {
      await abortCampaignSend(token, campaign.id, q);
      toast.success('Durdurma isteği gönderildi');
      onSent?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Hata');
    } finally {
      setAborting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/50 bg-white/80 p-4 shadow-sm dark:border-zinc-800/40 dark:bg-zinc-900/60 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-sm">{campaign.title}</p>
          <span className={cn('inline-block mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold', STATUS_COLORS[campaign.status])}>
            {STATUS_LABELS[campaign.status]}
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {campaign.status === 'sending' && linkMode === false && (
            <Button size="sm" variant="outline" className="gap-1 text-destructive" disabled={aborting} onClick={() => void abortSend()}>
              {aborting ? <LoadingSpinner className="size-4" /> : <StopCircle className="size-4" />}
              Durdur
            </Button>
          )}
          {(campaign.status === 'preview' || campaign.status === 'failed') && (
            <>
              {linkMode === null ? (
                <LoadingSpinner className="size-6" />
              ) : linkMode === false ? (
                <Button size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700" disabled={sending} onClick={send}>
                  {sending ? <LoadingSpinner className="size-4" /> : <Send className="size-4" />}
                  Gönder
                </Button>
              ) : null}
            </>
          )}
        </div>
      </div>

      {showManual ? (
        <ManualWhatsappSendPanel campaign={campaign} token={token} q={q} onUpdate={onSent} />
      ) : null}

      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-xl bg-slate-50 py-2 dark:bg-zinc-800/50">
          <Clock className="mx-auto mb-0.5 size-4 text-slate-500" />
          <p className="font-bold text-sm">{campaign.totalCount}</p>
          <p className="text-muted-foreground">Toplam</p>
        </div>
        <div className="rounded-xl bg-green-50 py-2 dark:bg-green-950/20">
          <CheckCircle2 className="mx-auto mb-0.5 size-4 text-green-600" />
          <p className="font-bold text-sm text-green-700">{campaign.sentCount}</p>
          <p className="text-green-600">Gönderildi</p>
        </div>
        <div className="rounded-xl bg-red-50 py-2 dark:bg-red-950/20">
          <XCircle className="mx-auto mb-0.5 size-4 text-red-500" />
          <p className="font-bold text-sm text-red-600">{campaign.failedCount}</p>
          <p className="text-red-500">Hatalı</p>
        </div>
      </div>

      {linkMode === false && campaign.failedCount > 0 && (campaign.status === 'completed' || campaign.status === 'failed') && (
        <div className="rounded-xl border border-red-200/70 bg-red-50/40 p-2 dark:border-red-900/40 dark:bg-red-950/20">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 text-left text-xs font-semibold text-red-900 dark:text-red-100"
            onClick={() => {
              setFailOpen((o) => !o);
              if (!failOpen) void loadFailures();
            }}
          >
            <span className="flex items-center gap-1.5">
              <OctagonAlert className="size-4 shrink-0" />
              Başarısız alıcılar ({campaign.failedCount})
            </span>
            <span className="text-[10px] font-normal opacity-80">{failOpen ? 'Gizle' : 'Detay'}</span>
          </button>
          {failOpen && (
            <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-[11px] text-red-950/90 dark:text-red-100/90">
              {failedRows.length === 0 ? (
                <li className="text-muted-foreground">Yükleniyor…</li>
              ) : (
                failedRows.map((r) => (
                  <li key={r.id} className="rounded border border-red-100/80 bg-white/60 px-2 py-1 dark:border-red-900/30 dark:bg-zinc-900/40">
                    <span className="font-medium">{r.recipientName ?? '—'}</span>
                    {r.phone ? <span className="text-muted-foreground"> · {r.phone}</span> : null}
                    {r.errorMsg ? <span className="mt-0.5 block text-red-800/90 dark:text-red-200/90">{r.errorMsg}</span> : null}
                  </li>
                ))
              )}
            </ul>
          )}
          <Button
            size="sm"
            variant="outline"
            className="mt-2 w-full gap-1 border-red-300 text-red-800 hover:bg-red-100 dark:border-red-800 dark:text-red-200"
            disabled={retrying}
            onClick={() => void retryFailed()}
          >
            {retrying ? <LoadingSpinner className="size-4" /> : <RotateCcw className="size-4" />}
            Başarısızları yeniden dene
          </Button>
        </div>
      )}

      {campaign.status === 'completed' && (
        <div className="rounded-xl bg-green-50 dark:bg-green-950/20 p-2">
          <div className="mb-1 flex justify-between text-xs font-semibold text-green-700">
            <span>İlerleme</span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-green-100 dark:bg-green-900/40">
            <div className="h-2 rounded-full bg-green-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}
