'use client';

import { useState } from 'react';
import { Campaign, executeCampaign, STATUS_COLORS, STATUS_LABELS } from '@/lib/messaging-api';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';
import { Send, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  campaign: Campaign;
  token: string | null | undefined;
  q: string;
  onSent?: () => void;
}

export default function SendPanel({ campaign, token, q, onSent }: Props) {
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!confirm(`"${campaign.title}" kampanyasındaki ${campaign.totalCount} kişiye mesaj gönderilecek. Devam?`)) return;
    setSending(true);
    try {
      const res = await executeCampaign(token ?? '', campaign.id, q);
      toast.success(`Gönderim başladı — ${res.total} alıcı`);
      onSent?.();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Hata'); }
    finally { setSending(false); }
  };

  const pct = campaign.totalCount > 0 ? Math.round((campaign.sentCount / campaign.totalCount) * 100) : 0;

  return (
    <div className="rounded-2xl border border-white/50 bg-white/80 p-4 shadow-sm dark:border-zinc-800/40 dark:bg-zinc-900/60 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-sm">{campaign.title}</p>
          <span className={cn('inline-block mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold', STATUS_COLORS[campaign.status])}>
            {STATUS_LABELS[campaign.status]}
          </span>
        </div>
        {(campaign.status === 'preview' || campaign.status === 'failed') && (
          <Button size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700" disabled={sending} onClick={send}>
            {sending ? <LoadingSpinner className="size-4" /> : <Send className="size-4" />}
            Gönder
          </Button>
        )}
      </div>

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

      {campaign.status === 'completed' && (
        <div className="rounded-xl bg-green-50 dark:bg-green-950/20 p-2">
          <div className="mb-1 flex justify-between text-xs font-semibold text-green-700">
            <span>İlerleme</span><span>{pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-green-100 dark:bg-green-900/40">
            <div className="h-2 rounded-full bg-green-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}
