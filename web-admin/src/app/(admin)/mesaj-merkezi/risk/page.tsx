'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { msgQ, fetchRiskList } from '@/lib/messaging-api';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import Link from 'next/link';

export default function RiskPage() {
  const { me, token } = useAuth();
  const q = msgQ(me?.role, useSearchParams().get('school_id'));
  const [items, setItems] = useState<Array<{ kind: string; studentName: string; className: string; phone: string; score: number; detail: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    void fetchRiskList(token, q).then((r) => setItems(r.items)).finally(() => setLoading(false));
  }, [token, q]);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-3">
      <h2 className="font-bold text-sm">Risk listesi (30 gün)</h2>
      {items.length === 0 ? <p className="text-sm text-muted-foreground">Kayıt yok.</p> : (
        <ul className="space-y-2">
          {items.map((it, i) => (
            <li key={i} className="rounded-lg border p-3 text-sm">
              <div className="flex justify-between">
                <span className="font-semibold">{it.studentName} · {it.className}</span>
                <span className="text-xs text-amber-600">skor {it.score}</span>
              </div>
              <p className="text-xs text-muted-foreground">{it.detail}</p>
              {it.phone && (
                <Link href={`/mesaj-merkezi/iletisim-defteri${q}${q.includes('?') ? '&' : '?'}phone=${it.phone}`} className="text-xs text-indigo-600 underline">
                  Defter
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
