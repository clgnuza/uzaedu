'use client';

import { useEffect, useState } from 'react';
import { listOfflineQueue } from '@/lib/pwa-offline-queue';
import { CloudOff } from 'lucide-react';

/** Bekleyen çevrimdışı API işlemi rozeti */
export function PwaOfflineQueueBadge() {
  const [n, setN] = useState(0);

  useEffect(() => {
    const tick = () => void listOfflineQueue().then((q) => setN(q.length));
    tick();
    window.addEventListener('online', tick);
    const id = window.setInterval(tick, 8000);
    return () => {
      window.removeEventListener('online', tick);
      clearInterval(id);
    };
  }, []);

  if (n === 0) return null;

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:text-amber-200">
      <CloudOff className="size-3" aria-hidden />
      {n} bekleyen gönderim
    </span>
  );
}
