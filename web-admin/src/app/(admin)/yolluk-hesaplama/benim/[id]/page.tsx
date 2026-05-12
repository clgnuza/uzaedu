'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Calc = {
  id: string;
  kind: string;
  status: string;
  title: string | null;
  inputs: Record<string, unknown>;
  result: { total_tl?: number; lines?: { key: string; label: string; amount_tl: number }[] };
  rules_snapshot: Record<string, unknown>;
  finalized_at: string | null;
};

export default function YollukBenimDetayPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { me } = useAuth();
  const [c, setC] = useState<Calc | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (me?.role !== 'teacher') {
      router.replace('/403');
      return;
    }
    if (!id) return;
    (async () => {
      try {
        const row = await apiFetch<Calc>(`/yolluk/calculations/${id}`);
        setC(row);
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [id, me?.role, router]);

  if (me?.role !== 'teacher') return null;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Yolluk detayı</h1>
      {err && <p className="text-sm text-destructive">{err}</p>}
      {c && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{c.title || c.kind}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              Durum: <strong>{c.status}</strong>
            </p>
            <p>
              Toplam: <strong>{(c.result?.total_tl as number)?.toFixed?.(2)}</strong> TL
            </p>
            <div>
              <p className="font-medium">Kalemler</p>
              <ul className="list-inside list-disc">
                {(c.result?.lines ?? []).map((l) => (
                  <li key={l.key}>
                    {l.label}: {l.amount_tl.toFixed(2)} TL
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-medium">Girdiler (JSON)</p>
              <pre className="bg-muted max-h-48 overflow-auto rounded p-2 text-xs">{JSON.stringify(c.inputs, null, 2)}</pre>
            </div>
            <div>
              <p className="font-medium">Parametre anlık görüntüsü</p>
              <pre className="bg-muted max-h-48 overflow-auto rounded p-2 text-xs">{JSON.stringify(c.rules_snapshot, null, 2)}</pre>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
