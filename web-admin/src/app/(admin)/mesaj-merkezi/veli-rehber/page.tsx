'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { msgQ, fetchVeliDirectory, syncVeliDirectory } from '@/lib/messaging-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';

export default function VeliRehberPage() {
  const { me, token } = useAuth();
  const q = msgQ(me?.role, useSearchParams().get('school_id'));
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<Array<{ id: string; phone: string; contactName: string | null; studentName: string | null; className: string | null }>>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      setRows(await fetchVeliDirectory(token, q, search || undefined));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [token, q]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input placeholder="Ara…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-9" />
        <Button size="sm" onClick={() => void load()}>Ara</Button>
        <Button size="sm" variant="outline" onClick={async () => {
          const r = await syncVeliDirectory(token!, q);
          toast.success(`${r.upserted} kayıt güncellendi`);
          void load();
        }}>Kampanyalardan senkron</Button>
      </div>
      {loading ? <LoadingSpinner /> : (
        <ul className="max-h-[60vh] overflow-y-auto text-xs space-y-1">
          {rows.map((r) => (
            <li key={r.id} className="rounded border px-2 py-1.5">
              {r.phone} · {r.contactName ?? '—'} · {r.studentName ?? '—'} · {r.className ?? '—'}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
