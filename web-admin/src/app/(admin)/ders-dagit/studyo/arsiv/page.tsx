'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useDersDagitStudio } from '@/hooks/use-ders-dagit-studio';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

type Program = {
  id: string;
  name: string | null;
  status: string;
  score: number | null;
  archived_at?: string | null;
};

export default function ArsivPage() {
  const { token } = useAuth();
  const { studio } = useDersDagitStudio();
  const [rows, setRows] = useState<Program[]>([]);

  const load = useCallback(async () => {
    if (!token || !studio) return;
    const list = await apiFetch<Program[]>(
      `/ders-dagit/studios/${studio.id}/programs?include_archived=1`,
      { token },
    );
    setRows(list.filter((p) => p.archived_at));
  }, [token, studio]);

  useEffect(() => {
    void load();
  }, [load]);

  async function archive(id: string) {
    if (!token || !studio) return;
    await apiFetch(`/ders-dagit/studios/${studio.id}/programs/${id}/archive`, { token, method: 'POST' });
    toast.success('Arşivlendi');
    await load();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Program arşivi</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {rows.length === 0 && <p className="text-muted-foreground">Arşivlenmiş program yok.</p>}
        {rows.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-border p-2">
            <span>
              {p.name ?? p.id.slice(0, 8)} — skor {p.score ?? '—'}
            </span>
            <span className="text-xs text-muted-foreground">{p.archived_at?.slice(0, 10)}</span>
          </div>
        ))}
        <p className="text-xs text-muted-foreground pt-2">
          Aktif listeden arşivlemek için Yayın sayfasından program seçin.
        </p>
      </CardContent>
    </Card>
  );
}
