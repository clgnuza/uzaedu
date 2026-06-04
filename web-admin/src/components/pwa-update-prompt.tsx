'use client';

import { useEffect, useState } from 'react';
import { useSerwist } from '@serwist/next/react';
import { Button } from '@/components/ui/button';

export function PwaUpdatePrompt() {
  const { serwist } = useSerwist();
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    if (!serwist) return;
    const onWaiting = () => setWaiting(true);
    serwist.addEventListener('waiting', onWaiting);
    return () => serwist.removeEventListener('waiting', onWaiting);
  }, [serwist]);

  if (!waiting) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[9999] flex justify-center p-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
      <div className="flex max-w-md items-center gap-2 rounded-lg border bg-background px-3 py-2 shadow-lg">
        <p className="flex-1 text-xs">Yeni sürüm hazır.</p>
        <Button
          type="button"
          size="sm"
          className="h-7 text-[10px]"
          onClick={() => {
            serwist?.messageSkipWaiting();
            window.location.reload();
          }}
        >
          Güncelle
        </Button>
      </div>
    </div>
  );
}
