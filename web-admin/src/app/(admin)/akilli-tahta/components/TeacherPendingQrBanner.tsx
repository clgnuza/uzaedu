'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { QrCode } from 'lucide-react';
import { smartBoardNotificationHref } from '@/lib/smart-board-notification-link';

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
          setItems(list.filter((n) => !n.read_at && n.event_type === 'smart_board.qr_pending'));
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
    <Alert variant="info" className="mb-3 sm:mb-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <QrCode className="size-4 shrink-0" />
            {top.title}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {top.body ?? top.metadata?.device_name ?? 'Tahta onayı bekleniyor'}
            {items.length > 1 ? ` (+${items.length - 1} diğer)` : ''}
          </p>
        </div>
        <Button type="button" size="sm" variant="default" asChild>
          <Link href={smartBoardNotificationHref(top)}>QR okut</Link>
        </Button>
        <Button type="button" size="sm" variant="secondary" asChild>
          <Link href="/bildirimler?filter=smart_board">Bildirimler</Link>
        </Button>
      </div>
    </Alert>
  );
}
