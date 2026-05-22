'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import {
  approveCampaign,
  loadPendingApprovals,
  rejectCampaign,
  msgQ,
  TYPE_LABELS,
  Campaign,
} from '@/lib/messaging-api';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';
import { Check, X } from 'lucide-react';

export default function OnayPage() {
  const searchParams = useSearchParams();
  const { me, token } = useAuth();
  const q = msgQ(me?.role, searchParams.get('school_id'));
  const [rows, setRows] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      setRows(await loadPendingApprovals(token, q));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [token, q]);

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner /></div>;

  return (
    <div className="space-y-4">
      <p className="font-bold text-base">Öğretmen kampanya onayı</p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Bekleyen onay yok.</p>
      ) : (
        rows.map((c) => (
          <div key={c.id} className="rounded-xl border p-4 flex flex-wrap items-center justify-between gap-3 bg-white/80 dark:bg-zinc-900/60">
            <div>
              <p className="font-semibold text-sm">{c.title}</p>
              <p className="text-xs text-muted-foreground">{TYPE_LABELS[c.type] ?? c.type} · {c.totalCount} alıcı</p>
              <Link href={`/mesaj-merkezi/kampanya/${c.id}${q}`} className="text-xs text-indigo-600 underline">
                Detay
              </Link>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="gap-1 bg-emerald-600"
                onClick={async () => {
                  await approveCampaign(token ?? '', c.id, q);
                  toast.success('Onaylandı');
                  void load();
                }}
              >
                <Check className="size-4" />
                Onayla
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1 text-red-600"
                onClick={async () => {
                  await rejectCampaign(token ?? '', c.id, q, 'Yönetici reddi');
                  toast.success('Reddedildi');
                  void load();
                }}
              >
                <X className="size-4" />
                Red
              </Button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
