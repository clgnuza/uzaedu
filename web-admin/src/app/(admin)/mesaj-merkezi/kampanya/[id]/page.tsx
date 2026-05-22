'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import {
  loadCampaignDetail,
  loadRecipients,
  msgQ,
  TYPE_LABELS,
  STATUS_LABELS,
  Campaign,
  Recipient,
  fetchRsvpSummary,
} from '@/lib/messaging-api';
import CampaignPreviewStep from '../../components/CampaignPreviewStep';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
export default function KampanyaDetayPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { me, token } = useAuth();
  const q = msgQ(me?.role, searchParams.get('school_id'));

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [rsvp, setRsvp] = useState<{ yes: number; no: number; pending: number; total: number } | null>(null);

  const refresh = useCallback(async () => {
    if (!token || !id) return;
    const [c, r] = await Promise.all([
      loadCampaignDetail(token, id, q),
      loadRecipients(token, id, q),
    ]);
    setCampaign(c);
    setRecipients(r);
    if (c && ['veli_toplantisi', 'davetiye'].includes(c.type)) {
      const s = await fetchRsvpSummary(token, q, id);
      if (s && 'yes' in s) setRsvp(s);
    } else setRsvp(null);
  }, [token, id, q]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        await refresh();
      } finally {
        setLoading(false);
      }
    })();
  }, [refresh]);

  if (loading || !campaign) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" className="gap-1" asChild>
        <Link href={`/mesaj-merkezi${q}`}>
          <ChevronLeft className="size-4" />
          Genel Bakış
        </Link>
      </Button>

      {campaign.approvalStatus === 'pending' ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm dark:bg-amber-950/30">
          <p className="font-semibold text-amber-900 dark:text-amber-100">Onay bekliyor</p>
          <p className="text-xs text-amber-800/90 mt-0.5">
            Yönetici onayından sonra gönderim yapılabilir.{' '}
            <Link href={`/mesaj-merkezi/onay${q}`} className="underline font-semibold">
              Onay kuyruğu
            </Link>
          </p>
        </div>
      ) : null}

      {campaign.scheduledAt ? (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-xs dark:bg-indigo-950/30">
          Zamanlanmış gönderim:{' '}
          <strong>{new Date(campaign.scheduledAt).toLocaleString('tr-TR')}</strong>
        </div>
      ) : null}

      {rsvp ? (
        <div className="rounded-xl border border-cyan-200 bg-cyan-50/60 px-4 py-3 text-sm dark:bg-cyan-950/30">
          <p className="font-semibold">RSVP (EVET/HAYIR yanıtları)</p>
          <p className="text-xs mt-1">Evet: {rsvp.yes} · Hayır: {rsvp.no} · Bekleyen: {rsvp.pending} / {rsvp.total}</p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-indigo-100 px-2 py-0.5 font-semibold text-indigo-800 dark:bg-indigo-950/50">
          {TYPE_LABELS[campaign.type] ?? campaign.type}
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold dark:bg-zinc-800">
          {STATUS_LABELS[campaign.status] ?? campaign.status}
        </span>
      </div>

      <CampaignPreviewStep
        campaign={campaign}
        recipients={recipients}
        token={token}
        q={q}
        onRefresh={refresh}
        enablePdfPreview
      />
    </div>
  );
}
