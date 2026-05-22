'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Campaign,
  executeCampaign,
  scheduleCampaign,
  getDeliveryHint,
  loadRecipients,
  retryFailedCampaign,
  abortCampaignSend,
  STATUS_COLORS,
  STATUS_LABELS,
  type DeliveryHint,
  type MessagingChannel,
  type Recipient,
} from '@/lib/messaging-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';
import { Send, CheckCircle2, XCircle, Clock, OctagonAlert, RotateCcw, StopCircle, MessageSquare, CalendarClock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  campaign: Campaign;
  token: string | null | undefined;
  q: string;
  onSent?: () => void;
}

export default function SendPanel({ campaign, token, q, onSent }: Props) {
  const [sending, setSending] = useState(false);
  const [hint, setHint] = useState<DeliveryHint | null>(null);
  const [channel, setChannel] = useState<MessagingChannel>('whatsapp');
  const [smsHeader, setSmsHeader] = useState('');
  const [failedRows, setFailedRows] = useState<Recipient[]>([]);
  const [failOpen, setFailOpen] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [aborting, setAborting] = useState(false);
  const [scheduleAt, setScheduleAt] = useState('');
  const [scheduling, setScheduling] = useState(false);

  const approvalBlocked = campaign.approvalStatus === 'pending' || campaign.approvalStatus === 'rejected';

  useEffect(() => {
    if (!token) return;
    void getDeliveryHint(token, q)
      .then((h) => {
        setHint(h);
        if (h.smsReady && !h.whatsappReady) setChannel('sms');
        else if (h.whatsappReady) setChannel('whatsapp');
      })
      .catch(() => setHint({ whatsappReady: false, smsReady: false, apiReady: false }));
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
    if (campaign.failedCount <= 0) return;
    void loadFailures();
  }, [campaign.failedCount, campaign.id, loadFailures]);

  const channelReady = channel === 'sms' ? hint?.smsReady : hint?.whatsappReady;
  const hasPdfCampaign =
    !!(campaign.metadata?.hasAttachment) ||
    ['karne', 'ara_karne', 'devamsizlik_mektup'].includes(campaign.type);

  const send = async () => {
    if (!channelReady) {
      return toast.error(channel === 'sms' ? 'SMS ayarları eksik veya pasif' : 'WhatsApp API ayarları eksik veya pasif');
    }
    if (channel === 'sms' && hasPdfCampaign) {
      return toast.error('Bu kampanya türünde SMS ile gönderim yapılamaz (PDF). WhatsApp seçin.');
    }
    const chLabel = channel === 'sms' ? 'SMS' : 'WhatsApp API';
    if (!confirm(`"${campaign.title}" — ${campaign.totalCount} kişiye ${chLabel} ile gönderilecek. Devam?`)) return;
    setSending(true);
    try {
      const res = await executeCampaign(token ?? '', campaign.id, q, {
        channel,
        ...(channel === 'sms' && smsHeader.trim() ? { smsHeader: smsHeader.trim() } : {}),
      });
      toast.success(`${chLabel} gönderimi başladı — ${res.total} alıcı`);
      onSent?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Hata');
    } finally {
      setSending(false);
    }
  };

  const pct = campaign.totalCount > 0 ? Math.round((campaign.sentCount / campaign.totalCount) * 100) : 0;

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
    if (!confirm('Gönderimi durdurmak istediğinize emin misiniz?')) return;
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
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="font-semibold text-sm">{campaign.title}</p>
          <span className={cn('inline-block mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold', STATUS_COLORS[campaign.status])}>
            {STATUS_LABELS[campaign.status]}
          </span>
          {(campaign.metadata?.channel as string) && campaign.status !== 'preview' ? (
            <span className="ml-1 text-[10px] text-muted-foreground">
              · {(campaign.metadata.channel as string) === 'sms' ? 'SMS' : 'WhatsApp'}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {campaign.status === 'sending' && (
            <Button size="sm" variant="outline" className="gap-1 text-destructive" disabled={aborting} onClick={() => void abortSend()}>
              {aborting ? <LoadingSpinner className="size-4" /> : <StopCircle className="size-4" />}
              Durdur
            </Button>
          )}
          {(campaign.status === 'preview' || campaign.status === 'failed') && !approvalBlocked && (
            <Button
              size="sm"
              className="gap-1.5 bg-green-600 hover:bg-green-700"
              disabled={sending || !channelReady}
              onClick={send}
            >
              {sending ? <LoadingSpinner className="size-4" /> : <Send className="size-4" />}
              Gönder
            </Button>
          )}
        </div>
      </div>

      {(campaign.status === 'preview' || campaign.status === 'failed') && hint ? (
        <div className="rounded-xl border bg-slate-50/80 p-3 dark:bg-zinc-900/50 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">Gönderim kanalı</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!hint.whatsappReady}
              onClick={() => setChannel('whatsapp')}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors',
                channel === 'whatsapp' ? 'border-green-500 bg-green-600 text-white' : 'opacity-60',
                !hint.whatsappReady && 'cursor-not-allowed',
              )}
            >
              WhatsApp API
            </button>
            <button
              type="button"
              disabled={!hint.smsReady || hasPdfCampaign}
              onClick={() => setChannel('sms')}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors',
                channel === 'sms' ? 'border-sky-500 bg-sky-600 text-white' : 'opacity-60',
                (!hint.smsReady || hasPdfCampaign) && 'cursor-not-allowed',
              )}
            >
              <MessageSquare className="inline size-3.5 mr-1" />
              SMS (başlıklı)
            </button>
          </div>
          {channel === 'sms' ? (
            <div>
              <label className="mb-1 block text-[11px] font-medium text-muted-foreground">SMS başlığı (gönderici adı, max 11)</label>
              <Input
                className="h-9 text-sm"
                maxLength={11}
                value={smsHeader}
                onChange={(e) => setSmsHeader(e.target.value.toUpperCase())}
                placeholder="Örn: OKULADI"
              />
              <p className="mt-0.5 text-[10px] text-muted-foreground">Boş bırakılırsa ayarlardaki varsayılan başlık kullanılır.</p>
            </div>
          ) : null}
          {!channelReady ? (
            <p className="text-[11px] text-amber-700 dark:text-amber-300">Seçilen kanal için ayarlar eksik. Mesaj Merkezi → Ayarlar.</p>
          ) : null}
          {!approvalBlocked && channelReady ? (
            <div className="flex flex-wrap items-end gap-2 pt-1 border-t border-dashed">
              <div className="flex-1 min-w-[160px]">
                <label className="text-[10px] font-medium text-muted-foreground">Zamanla</label>
                <input
                  type="datetime-local"
                  value={scheduleAt}
                  onChange={(e) => setScheduleAt(e.target.value)}
                  className="mt-0.5 h-9 w-full rounded-lg border px-2 text-sm dark:bg-zinc-900"
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                disabled={scheduling || !scheduleAt}
                onClick={async () => {
                  setScheduling(true);
                  try {
                    await scheduleCampaign(token ?? '', campaign.id, q, {
                      at: new Date(scheduleAt).toISOString(),
                      channel,
                      ...(channel === 'sms' && smsHeader.trim() ? { smsHeader: smsHeader.trim() } : {}),
                    });
                    toast.success('Gönderim zamanlandı');
                    onSent?.();
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : 'Hata');
                  } finally {
                    setScheduling(false);
                  }
                }}
              >
                {scheduling ? <LoadingSpinner className="size-4" /> : <CalendarClock className="size-4" />}
                Zamanla
              </Button>
            </div>
          ) : null}
        </div>
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

      {campaign.failedCount > 0 && (campaign.status === 'completed' || campaign.status === 'failed') && (
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
