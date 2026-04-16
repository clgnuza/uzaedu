'use client';

import { useCallback, useEffect, useState } from 'react';
import { Campaign, getMyMessagingPreferences, getWaManualLinks, markRecipientManualSent } from '@/lib/messaging-api';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';
import { ExternalLink, CheckCircle2, Smartphone } from 'lucide-react';

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

export default function ManualWhatsappSendPanel({ campaign, token, q, onUpdate }: Props) {
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | undefined>();
  const [items, setItems] = useState<Item[]>([]);
  const [marking, setMarking] = useState<string | null>(null);
  const [openWaInNewTab, setOpenWaInNewTab] = useState(true);

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
    setMarking(id);
    try {
      await markRecipientManualSent(token, id, q);
      toast.success('Gönderildi olarak işaretlendi');
      await load();
      onUpdate?.();
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
      {items.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="size-4 text-green-600" />
          Bekleyen alıcı yok (gönderim tamamlanmış olabilir).
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((row) => (
            <li
              key={row.id}
              className="flex flex-col gap-2 rounded-lg border border-white/60 bg-white/90 p-2.5 dark:border-zinc-700/60 dark:bg-zinc-900/70 sm:rounded-xl sm:p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 text-sm">
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
