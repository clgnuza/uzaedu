'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { downloadYollukPdf } from '@/lib/yolluk-pdf-download';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Calc = {
  id: string;
  teacher_user_id: string;
  kind: string;
  status: string;
  title: string | null;
  result: { total_tl?: number };
  created_at: string;
};

export default function YollukRaporPage() {
  const router = useRouter();
  const { me } = useAuth();
  const can = me?.role === 'school_admin' || me?.role === 'superadmin';
  const [schoolIdSa, setSchoolIdSa] = useState('');
  const [list, setList] = useState<Calc[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const qs = new URLSearchParams();
    if (me?.role === 'superadmin' && schoolIdSa.trim()) qs.set('school_id', schoolIdSa.trim());
    qs.set('archived', 'active');
    const rows = await apiFetch<Calc[]>(`/yolluk/calculations?${qs.toString()}`);
    setList(rows);
  }, [me?.role, schoolIdSa]);

  useEffect(() => {
    if (!can) {
      router.replace('/403');
      return;
    }
    if (me?.role === 'superadmin' && !schoolIdSa.trim()) return;
    (async () => {
      try {
        setErr(null);
        await load();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setErr(msg);
        toast.error('Liste yüklenemedi', { description: msg });
      }
    })();
  }, [can, me?.role, router, load, schoolIdSa]);

  if (!can) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Yolluk resmi rapor (PDF)</h1>
        <p className="text-sm text-muted-foreground">
          Kurum içi özet PDF; ödeme ve kesin haklar için mali işler birimi ve mevzuat esas alınır. Geçici görev kayıtlarında bildirim tablosu
          doldurulmuşsa PDF ikinci bölümde tablo olarak yer alır.
        </p>
      </div>
      {err && <p className="text-sm text-destructive">{err}</p>}

      {me?.role === 'superadmin' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Okul seçimi</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-2">
            <div className="min-w-[220px] flex-1">
              <Label>Okul UUID</Label>
              <Input value={schoolIdSa} onChange={(e) => setSchoolIdSa(e.target.value)} placeholder="schools.id" />
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                void load()
                  .then(() => toast.success('Liste yenilendi'))
                  .catch((e) => {
                    const msg = e instanceof Error ? e.message : String(e);
                    setErr(msg);
                    toast.error('Yenileme başarısız', { description: msg });
                  })
              }
            >
              Listeyi yenile
            </Button>
          </CardContent>
        </Card>
      )}

      {me?.role === 'superadmin' && !schoolIdSa.trim() && (
        <p className="text-sm text-amber-600">Listelemek ve PDF almak için okul UUID girin.</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Kayıtlar</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="py-2 pr-2">Başlık / tür</th>
                <th className="py-2 pr-2">Durum</th>
                <th className="py-2 pr-2">Toplam TL</th>
                <th className="py-2 pr-2">Tarih</th>
                <th className="py-2 text-right">PDF</th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id} className="border-b border-border/60">
                  <td className="py-2 pr-2">
                    <div className="font-medium">{c.title || '—'}</div>
                    <div className="text-muted-foreground text-xs">{c.kind}</div>
                  </td>
                  <td className="py-2 pr-2">{c.status}</td>
                  <td className="py-2 pr-2">{(c.result?.total_tl as number)?.toFixed?.(2) ?? c.result?.total_tl ?? '—'}</td>
                  <td className="py-2 pr-2 text-muted-foreground">{new Date(c.created_at).toLocaleString('tr-TR')}</td>
                  <td className="py-2 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pdfBusy === c.id}
                      onClick={() => {
                        setPdfBusy(c.id);
                        setErr(null);
                        downloadYollukPdf(c.id)
                          .then(() => toast.success('PDF indirildi'))
                          .catch((e) => {
                            const msg = e instanceof Error ? e.message : String(e);
                            setErr(msg);
                            toast.error('PDF indirilemedi', { description: msg });
                          })
                          .finally(() => setPdfBusy(null));
                      }}
                    >
                      {pdfBusy === c.id ? '…' : 'PDF indir'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length === 0 && <p className="text-muted-foreground py-4 text-sm">Kayıt yok.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
