'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { QrCode } from 'lucide-react';
import { smartBoardNotificationHref } from '@/lib/smart-board-notification-link';
import { dedupeSmartBoardQrPending } from '@/lib/dedupe-smart-board-notifications';

type Notif = {
  id: string;
  event_type?: string;
  title: string;
  body: string | null;
  read_at: string | null;
  metadata?: { device_name?: string; class_section?: string; device_id?: string } | null;
};

export function TeacherPendingQrBanner({ token }: { token: string | null }) {
  const [items, setItems] = useState<Notif[]>([]);

  useEffect(() => {
    if (!token) return;
    const load = () => {
      apiFetch<{ items?: Notif[] }>('/notifications?page=1&limit=8&event_type=smart_board', { token })
        .then((res) => {
          const list = Array.isArray(res?.items) ? res.items : [];
          setItems(
            dedupeSmartBoardQrPending(
              list.filter((n) => !n.read_at && n.event_type === 'smart_board.qr_pending'),
            ),
          );
        })
        .catch(() => setItems([]));
    };
    load();
    const id = setInterval(load, 25_000);
    const onClaim = () => load();
    window.addEventListener('smart-board:qr-claimed', onClaim);
    return () => {
      clearInterval(id);
      window.removeEventListener('smart-board:qr-claimed', onClaim);
    };
  }, [token]);

  if (items.length === 0) return null;

  const top = items[0]!;

  return (
    <div className="mb-2 flex items-center gap-2 rounded-xl border border-sky-500/35 bg-sky-500/10 px-3 py-2.5">
      <QrCode className="size-4 shrink-0 text-sky-700 dark:text-sky-300" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold">{top.title}</p>
        <p className="truncate text-[10px] text-muted-foreground">
          {top.body ?? top.metadata?.device_name ?? 'Onay bekleniyor'}
          {items.length > 1 ? ` · +${items.length - 1}` : ''}
        </p>
      </div>
      <Button type="button" size="sm" className="h-8 shrink-0 rounded-lg px-3 text-xs font-semibold" asChild>
        <Link href={smartBoardNotificationHref(top)}>Okut</Link>
      </Button>
    </div>
  );
}
