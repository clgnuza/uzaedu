'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useDersDagitStudio } from '@/hooks/use-ders-dagit-studio';
import { apiFetch } from '@/lib/api';
import type { FairnessMetrics } from '@/lib/ders-dagit-fairness';
import { FairnessDashboard } from '@/components/ders-dagit/FairnessDashboard';
import { DD_PAGE } from '@/components/ders-dagit/dd-ui';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function AdaletPage() {
  const { token } = useAuth();
  const { studio } = useDersDagitStudio();
  const [data, setData] = useState<FairnessMetrics | null>(null);

  useEffect(() => {
    if (!token || !studio) return;
    void apiFetch<FairnessMetrics>(`/ders-dagit/studios/${studio.id}/fairness`, { token }).then(setData);
  }, [token, studio]);

  if (!data) {
    return <p className="text-sm text-muted-foreground">Yükleniyor…</p>;
  }

  if (!data.ready) {
    return (
      <div className={DD_PAGE}>
        <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">{data.message ?? 'Üretilmiş program yok.'}</p>
          <Button className="mt-4" asChild>
            <Link href="/ders-dagit/studyo/uret">Program üret</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={DD_PAGE}>
      <FairnessDashboard data={data} />
    </div>
  );
}
