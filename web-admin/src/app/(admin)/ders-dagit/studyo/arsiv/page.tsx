'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { useDersDagitStudio } from '@/hooks/use-ders-dagit-studio';
import {
  cloneProgram,
  deleteProgram,
  listStudioPrograms,
  unarchiveProgram,
  type DdProgramRow,
} from '@/lib/ders-dagit-program-api';
import { Button } from '@/components/ui/button';
import { DdCard, CardContent, CardHeader, CardTitle } from '@/components/ders-dagit/dd-ui';
import { toast } from 'sonner';

export default function ArsivPage() {
  const { token } = useAuth();
  const { studio } = useDersDagitStudio();
  const [rows, setRows] = useState<DdProgramRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !studio) return;
    const list = await listStudioPrograms(token, studio.id, { includeArchived: true });
    setRows(list.filter((p) => p.archived_at));
  }, [token, studio]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(id: string, fn: () => Promise<void>) {
    setBusy(id);
    try {
      await fn();
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'İşlem başarısız');
    } finally {
      setBusy(null);
    }
  }

  return (
    <DdCard>
      <CardHeader>
        <CardTitle className="text-base">Program arşivi</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {rows.length === 0 && <p className="text-muted-foreground">Arşivlenmiş program yok.</p>}
        {rows.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-border p-2">
            <div>
              <p className="font-medium">{p.name ?? p.id.slice(0, 8)}</p>
              <p className="text-xs text-muted-foreground">
                {p.status} · puan {p.score ?? '—'} · {p.archived_at?.slice(0, 10)}
              </p>
            </div>
            <div className="flex flex-wrap gap-1">
              <Button type="button" size="sm" variant="outline" asChild>
                <Link href={`/ders-dagit/studyo/program?id=${p.id}`}>Aç</Link>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={busy === p.id}
                onClick={() =>
                  void act(p.id, async () => {
                    await unarchiveProgram(token!, studio!.id, p.id);
                    toast.success('Arşivden çıkarıldı');
                  })
                }
              >
                Geri al
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy === p.id}
                onClick={() =>
                  void act(p.id, async () => {
                    const copy = await cloneProgram(token!, studio!.id, p.id);
                    toast.success(`Kopya: ${copy.name ?? copy.id.slice(0, 8)}`);
                  })
                }
              >
                Kopyala
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={busy === p.id || p.status === 'published'}
                onClick={() => {
                  if (!window.confirm('Kalıcı silinsin mi?')) return;
                  void act(p.id, async () => {
                    await deleteProgram(token!, studio!.id, p.id);
                    toast.success('Silindi');
                  });
                }}
              >
                Sil
              </Button>
            </div>
          </div>
        ))}
        <p className="text-xs text-muted-foreground pt-2">
          Aktif programlarda arşiv/sil/kopyala:{' '}
          <Link href="/ders-dagit/studyo/program" className="text-primary underline">
            Program tablosu
          </Link>
        </p>
      </CardContent>
    </DdCard>
  );
}
