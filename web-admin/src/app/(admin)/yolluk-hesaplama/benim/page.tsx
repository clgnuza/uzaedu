'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { downloadYollukPdf } from '@/lib/yolluk-pdf-download';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Calc = {
  id: string;
  kind: string;
  status: string;
  title: string | null;
  result: { total_tl?: number; lines?: { key: string; label: string; amount_tl: number }[] };
  finalized_at: string | null;
};

export default function YollukBenimPage() {
  const router = useRouter();
  const { me } = useAuth();
  const can = me?.role === 'teacher';
  const [list, setList] = useState<Calc[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!can) {
      router.replace('/403');
      return;
    }
    (async () => {
      try {
        const rows = await apiFetch<Calc[]>('/yolluk/calculations/mine');
        setList(rows);
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [can, router]);

  if (!can) return null;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Yolluk hesaplarım</h1>
      <p className="text-sm text-muted-foreground">Okul tarafından kesinleştirilen özet kayıtlar.</p>
      {err && <p className="text-sm text-destructive">{err}</p>}
      {list.length === 0 && !err && <p className="text-sm text-muted-foreground">Henüz kesinleşmiş hesap yok.</p>}
      <div className="grid gap-3">
        {list.map((c) => (
          <Card key={c.id}>
            <CardHeader className="py-3">
              <CardTitle className="text-base">{c.title || c.kind}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                Toplam: <strong>{(c.result?.total_tl as number)?.toFixed?.(2) ?? c.result?.total_tl}</strong> TL
              </p>
              <ul className="list-inside list-disc text-muted-foreground">
                {(c.result?.lines ?? []).map((l) => (
                  <li key={l.key}>
                    {l.label}: {l.amount_tl.toFixed(2)} TL
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2 pt-1">
                <Link className="text-primary text-sm font-medium hover:underline" href={`/yolluk-hesaplama/benim/${c.id}`}>
                  Detay
                </Link>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pdfBusy === c.id}
                  onClick={() => {
                    setPdfBusy(c.id);
                    setErr(null);
                    downloadYollukPdf(c.id)
                      .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
                      .finally(() => setPdfBusy(null));
                  }}
                >
                  {pdfBusy === c.id ? '…' : 'PDF indir'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
