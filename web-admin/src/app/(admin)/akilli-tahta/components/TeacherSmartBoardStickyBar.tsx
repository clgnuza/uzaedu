'use client';

import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { PowerOff, ScanLine } from 'lucide-react';
import { cn } from '@/lib/utils';

export function TeacherSmartBoardStickyBar({
  visible,
  hasActiveSession,
  busy,
  onScan,
  onDisconnect,
}: {
  visible: boolean;
  hasActiveSession: boolean;
  busy?: boolean;
  onScan: () => void;
  onDisconnect?: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted || !visible) return null;

  return createPortal(
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 z-[180] border-t border-border/80 bg-background/95 p-3 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] backdrop-blur-md',
        'pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:hidden',
      )}
    >
      <div className="mx-auto flex max-w-lg gap-2">
        {hasActiveSession && onDisconnect ? (
          <>
            <Button
              type="button"
              variant="outline"
              className="h-12 flex-1 rounded-2xl border-amber-400/60 text-sm font-semibold"
              onClick={onDisconnect}
            >
              <PowerOff className="size-4" />
              Bağlantıyı kes
            </Button>
            <Button
              type="button"
              disabled={busy}
              className="h-12 flex-1 rounded-2xl bg-linear-to-r from-violet-600 to-teal-600 text-sm font-semibold shadow-md"
              onClick={onScan}
            >
              {busy ? <LoadingSpinner className="size-4" /> : <ScanLine className="size-4" />}
              Yeni QR
            </Button>
          </>
        ) : (
          <Button
            type="button"
            disabled={busy}
            className="h-12 w-full gap-2 rounded-2xl bg-linear-to-r from-violet-600 to-teal-600 text-base font-semibold shadow-md"
            onClick={onScan}
          >
            {busy ? <LoadingSpinner className="size-5" /> : <ScanLine className="size-5" />}
            QR okut
          </Button>
        )}
      </div>
    </div>,
    document.body,
  );
}
