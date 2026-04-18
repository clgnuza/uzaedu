'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Campaign, getMyMessagingPreferences, getWaManualLinks, markRecipientManualSent } from '@/lib/messaging-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';
import { ExternalLink, CheckCircle2, Smartphone, Download, ListOrdered } from 'lucide-react';
import { cn } from '@/lib/utils';

type Item = {
  id: string;
  phone: string | null;
  recipientName: string | null;
  messageText: string | null;
  waUrl: string;
};

interface Props {
  campaign: Campaign;
  token: string | null | undefined;
  q: string;
  onUpdate?: () => void;
}

function csvEscape(s: string | null | undefined): string {
  const v = String(s ?? '');
  return `"${v.replace(/"/g, '""')}"`;
}

function downloadWaManualCsv(campaignTitle: string, rows: Item[]) {
  const header = ['ad', 'telefon', 'mesaj', 'wa_url'];
  const lines = [
    header.join(';'),
    ...rows.map((r) =>
      [csvEscape(r.recipientName), csvEscape(r.phone), csvEscape(r.messageText), csvEscape(r.waUrl)].join(';'),
    ),
  ];
  const blob = new Blob([`\ufeff${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `wa-manuel-${campaignTitle.replace(/[^\wğüşıöçĞÜŞİÖÇ]+/gi, '-').slice(0, 40) || 'kampanya'}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function ManualWhatsappSendPanel({ campaign, token, q, onUpdate }: Props) {
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | undefined>();
  const [items, setItems] = useState<Item[]>([]);
  const [marking, setMarking] = useState<string | null>(null);
  const [openWaInNewTab, setOpenWaInNewTab] = useState(true);
  const [delaySec, setDelaySec] = useState(3);
  const [autoOpenNext, setAutoOpenNext] = useState(false);
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    };
  }, []);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [res, prefs] = await Promise.all([
        getWaManualLinks(token, campaign.id, q),
        getMyMessagingPreferences(token, q).catch(() => ({ appendSignature: '', openWaInNewTab: true })),
      ]);
      setOpenWaInNewTab(prefs.openWaInNewTab !== false);
      setNotice(res.notice);
      setItems(res.items);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Bağlantılar yüklenemedi');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [token, campaign.id, q]);

  useEffect(() => {
    void load();
  }, [load]);

  const openWa = (url: string) => {
    if (!url) {
      toast.error('Geçersiz telefon');
      return;
    }
    if (openWaInNewTab) window.open(url, '_blank', 'noopener,noreferrer');
    else window.location.assign(url);
  };

  const markSent = async (id: string) => {
    if (!token) return;
    const idx = items.findIndex((x) => x.id === id);
    const nextRow = idx >= 0 ? items[idx + 1] : undefined;
    setMarking(id);
    try {
      await markRecipientManualSent(token, id, q);
      toast.success('Gönderildi olarak işaretlendi');
      await load();
      onUpdate?.();
      if (autoOpenNext && nextRow?.waUrl) {
        if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
        const ms = Math.max(0, Math.min(60, delaySec)) * 1000;
        autoTimerRef.current = setTimeout(() => openWa(nextRow.waUrl), ms);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Hata');
    } finally {
      setMarking(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <LoadingSpinner className="size-6" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/40 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20 space-y-2.5 sm:rounded-2xl sm:p-4 sm:space-y-3">
      <div className="flex items-start gap-1.5 sm:gap-2">
        <Smartphone className="mt-0.5 size-4 shrink-0 text-emerald-700 dark:text-emerald-400 sm:size-5" />
        <div>
          <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-100 sm:text-sm">WhatsApp ile gönder (API yok)</p>
          <p className="mt-0.5 text-[11px] leading-snug text-emerald-800/90 dark:text-emerald-200/90 sm:text-xs">
            Her alıcı için bağlantıyı açın; açık WhatsApp Web oturumunuz veya telefon uygulamanız kullanılır. Yalnızca izinli iletişim;{' '}
            <a href="https://www.whatsapp.com/legal/business-policy/" target="_blank" rel="noreferrer" className="underline">
              WhatsApp Business Policy
            </a>{' '}
            ve KVKK kapsamında sorumluluk okuldadır.
          </p>
        </div>
      </div>
      {notice ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
          {notice}
        </p>
      ) : null}

      {items.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-lg border border-emerald-200/50 bg-white/70 p-2 text-xs dark:border-emerald-900/40 dark:bg-zinc-900/50 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex flex-1 flex-col gap-0.5">
            <label className="font-medium text-emerald-900 dark:text-emerald-100">Sonraki wa.me gecikmesi (sn)</label>
            <Input
              type="number"
              min={0}
              max={60}
              className="h-8 max-w-[120px] text-xs"
              value={delaySec}
              onChange={(e) => setDelaySec(Number(e.target.value) || 0)}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-emerald-900 dark:text-emerald-100">
            <input type="checkbox" checked={autoOpenNext} onChange={(e) => setAutoOpenNext(e.target.checked)} className="rounded border-input" />
            Gönderildi sonrası sıradaki wa.me’yi otomatik aç
          </label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1 shrink-0 border-emerald-300 text-emerald-900 dark:border-emerald-800 dark:text-emerald-100"
            onClick={() => downloadWaManualCsv(campaign.title, items)}
          >
            <Download className="size-3.5" />
            CSV indir
          </Button>
        </div>
      ) : null}

      {items.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="size-4 text-green-600" />
          Bekleyen alıcı yok (gönderim tamamlanmış olabilir).
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((row, i) => (
            <li
              key={row.id}
              className={cn(
                'flex flex-col gap-2 rounded-lg border bg-white/90 p-2.5 dark:bg-zinc-900/70 sm:rounded-xl sm:p-3 sm:flex-row sm:items-center sm:justify-between',
                i === 0 ? 'ring-2 ring-emerald-500/70 border-emerald-300 dark:border-emerald-800' : 'border-white/60 dark:border-zinc-700/60',
              )}
            >
              <div className="min-w-0 text-sm">
                {i === 0 ? (
                  <p className="mb-0.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                    <ListOrdered className="size-3.5" />
                    Sıradaki
                  </p>
                ) : null}
                <p className="truncate font-medium">{row.recipientName ?? row.phone ?? '—'}</p>
                {row.messageText ? (
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{row.messageText}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="gap-1"
                  disabled={!row.waUrl}
                  onClick={() => openWa(row.waUrl)}
                >
                  <ExternalLink className="size-3.5" />
                  WhatsApp
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="gap-1 bg-green-600 hover:bg-green-700"
                  disabled={marking === row.id}
                  onClick={() => void markSent(row.id)}
                >
                  {marking === row.id ? <LoadingSpinner className="size-4" /> : <CheckCircle2 className="size-3.5" />}
                  Gönderildi
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
