'use client';

import { Campaign, Recipient, TYPE_LABELS } from '@/lib/messaging-api';
import { Button } from '@/components/ui/button';
import { RefreshCw, Upload, Users } from 'lucide-react';
import SendPanel from './SendPanel';
import CampaignPreviewTable from './CampaignPreviewTable';
interface Props {
  campaign: Campaign;
  recipients: Recipient[];
  token: string | null | undefined;
  q: string;
  onRefresh: () => void | Promise<void>;
  onBack?: () => void;
  backLabel?: string;
  enablePdfPreview?: boolean;
}

export default function CampaignPreviewStep({
  campaign,
  recipients,
  token,
  q,
  onRefresh,
  onBack,
  backLabel = 'Yeniden',
  enablePdfPreview,
}: Props) {
  const missingPhone = recipients.filter((r) => !r.phone?.trim()).length;
  const typeLabel = TYPE_LABELS[campaign.type] ?? campaign.type;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
        <div className="rounded-xl border bg-gradient-to-br from-indigo-50/80 via-white to-white p-4 dark:from-indigo-950/20 dark:via-zinc-900/60 dark:to-zinc-900/40">
          <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            Kampanya önizleme
          </p>
          <p className="mt-0.5 text-sm font-bold text-foreground">{campaign.title}</p>
          <p className="text-xs text-muted-foreground">{typeLabel}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold shadow-sm dark:bg-zinc-800">
              <Users className="size-3.5 text-indigo-500" />
              {recipients.length} alıcı
            </span>
            {missingPhone > 0 ? (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                {missingPhone} telefon eksik
              </span>
            ) : (
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                Telefonlar tamam
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2 sm:flex-col">
          {onBack ? (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={onBack}>
              <Upload className="size-4" />
              {backLabel}
            </Button>
          ) : null}
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void onRefresh()}>
            <RefreshCw className="size-4" />
            Yenile
          </Button>
        </div>
      </div>
      <SendPanel campaign={campaign} token={token} q={q} onSent={onRefresh} />
      <CampaignPreviewTable
        campaignId={campaign.id}
        campaignType={campaign.type}
        recipients={recipients}
        token={token}
        q={q}
        onChange={onRefresh}
        enablePdfPreview={enablePdfPreview}
      />
    </div>
  );
}
