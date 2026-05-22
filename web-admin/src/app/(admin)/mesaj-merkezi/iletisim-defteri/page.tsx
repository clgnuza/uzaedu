'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import {
  msgQ,
  fetchCommunicationDiary,
  fetchRecentCommunicationPhones,
  replyInboundMessage,
  type CommunicationDiary,
} from '@/lib/messaging-api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { cn } from '@/lib/utils';
import { Search, ArrowDownLeft, ArrowUpRight, Radio } from 'lucide-react';

const STATUS_TR: Record<string, string> = {
  sent: 'Gönderildi',
  delivered: 'İletildi',
  read: 'Okundu',
  failed: 'Başarısız',
  pending: 'Bekliyor',
};

function fmtPhone(p: string) {
  const d = p.replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('90')) return `+${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}`;
  return p;
}

export default function IletisimDefteriPage() {
  const searchParams = useSearchParams();
  const { me, token } = useAuth();
  const q = msgQ(me?.role, searchParams.get('school_id'));

  const [query, setQuery] = useState('');
  const [activePhone, setActivePhone] = useState('');
  const [diary, setDiary] = useState<CommunicationDiary | null>(null);
  const [recent, setRecent] = useState<Array<{ phone: string; lastAt: string }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    void fetchRecentCommunicationPhones(token, q).then(setRecent).catch(() => setRecent([]));
  }, [token, q]);

  const search = async (phone?: string) => {
    const p = (phone ?? query).trim();
    if (!p || !token) return;
    setLoading(true);
    setActivePhone(p);
    try {
      const d = await fetchCommunicationDiary(token, q, p);
      setDiary(d);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-bold">Veli iletişim defteri</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Giden kampanyalar, WhatsApp webhook iletim durumu ve gelen yanıtlar tek zaman çizelgesinde.
        </p>
        <div className="mt-3 flex gap-2">
          <Input
            placeholder="905xxxxxxxxx"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 text-sm"
            onKeyDown={(e) => e.key === 'Enter' && void search()}
          />
          <Button size="sm" className="h-9" onClick={() => void search()} disabled={loading}>
            <Search className="mr-1 size-3.5" />
            Ara
          </Button>
        </div>
        {recent.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {recent.map((r) => (
              <button
                key={r.phone}
                type="button"
                onClick={() => {
                  setQuery(r.phone);
                  void search(r.phone);
                }}
                className="rounded-full border px-2.5 py-0.5 text-[11px] hover:bg-muted"
              >
                {fmtPhone(r.phone)}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && <LoadingSpinner />}
      {!loading && diary && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">{fmtPhone(diary.phone)} — zaman çizelgesi</p>
          {diary.timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground">Kayıt yok.</p>
          ) : (
            diary.timeline.map((item, i) => (
              <TimelineRow
                key={`${item.kind}-${item.at}-${i}`}
                item={item}
                onReply={item.kind === 'inbound' && token ? async (id, note) => {
                  await replyInboundMessage(token, q, id, note);
                  toast.success('Not kaydedildi');
                  void search(activePhone);
                } : undefined}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function TimelineRow({
  item,
  onReply,
}: {
  item: CommunicationDiary['timeline'][number];
  onReply?: (id: string, note: string) => Promise<void>;
}) {
  const at = new Date(item.at).toLocaleString('tr-TR');
  const [note, setNote] = useState('');
  if (item.kind === 'inbound') {
    const p = item.payload as { id?: string; body?: string; senderName?: string; staffReply?: string };
    return (
      <div className="flex gap-2 rounded-lg border border-emerald-200/60 bg-emerald-50/50 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/30">
        <ArrowDownLeft className="mt-0.5 size-4 shrink-0 text-emerald-600" />
        <div className="min-w-0 flex-1">
          <div className="flex justify-between gap-2 text-[11px] text-muted-foreground">
            <span>Veli yanıtı</span>
            <span>{at}</span>
          </div>
          {p.senderName && <p className="text-xs font-medium">{p.senderName}</p>}
          <p className="mt-1 whitespace-pre-wrap text-sm">{p.body ?? '—'}</p>
          {p.staffReply && <p className="mt-2 text-xs text-indigo-700">Personel: {p.staffReply}</p>}
          {onReply && p.id && (
            <div className="mt-2 flex gap-1">
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="İç not / yanıt" className="h-8 text-xs" />
              <Button size="sm" className="h-8" onClick={() => void onReply(p.id!, note)}>Kaydet</Button>
            </div>
          )}
        </div>
      </div>
    );
  }
  if (item.kind === 'delivery') {
    const p = item.payload as { status?: string; provider?: string };
    return (
      <div className="flex gap-2 rounded-lg border border-amber-200/60 bg-amber-50/40 p-2.5 dark:border-amber-900/40 dark:bg-amber-950/20">
        <Radio className="mt-0.5 size-4 shrink-0 text-amber-600" />
        <div className="flex flex-1 justify-between text-xs">
          <span>
            İletim: <strong>{STATUS_TR[p.status ?? ''] ?? p.status}</strong> ({p.provider})
          </span>
          <span className="text-muted-foreground">{at}</span>
        </div>
      </div>
    );
  }
  const p = item.payload as {
    title?: string;
    status?: string;
    delivery_status?: string;
    message_text?: string;
    channel?: string;
    type?: string;
  };
  const ds = p.delivery_status ? STATUS_TR[p.delivery_status] ?? p.delivery_status : null;
  return (
    <div className="flex gap-2 rounded-lg border bg-card p-3 shadow-sm">
      <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-indigo-600" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-muted-foreground">
          <span>
            Giden · {p.channel ?? 'whatsapp'} · {p.title ?? p.type}
          </span>
          <span>{at}</span>
        </div>
        <p className={cn('text-xs font-medium', p.status === 'failed' && 'text-destructive')}>
          {STATUS_TR[p.status ?? ''] ?? p.status}
          {ds ? ` → ${ds}` : ''}
        </p>
        {p.message_text && (
          <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">{p.message_text}</p>
        )}
      </div>
    </div>
  );
}
