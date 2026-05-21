'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { TeacherQrScannerOverlay } from './TeacherQrScannerOverlay';
import { parseSmartBoardQrClaimUrl } from '@/lib/smart-board-qr-parse';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { SMART_BOARD_LESSON_SESSION_LABEL } from '@/lib/smart-board-teacher-qr-flow';
import { ChevronDown, ClipboardPaste, ScanLine } from 'lucide-react';

export function TeacherQrClaimPanel({
  onClaim,
  busy,
  deviceHint,
  highlight,
  scannerOpen,
  onScannerOpenChange,
}: {
  onClaim: (params: { school_id: string; device_id: string; session_id: string; code: string }) => Promise<void>;
  busy?: boolean;
  deviceHint?: string | null;
  highlight?: boolean;
  scannerOpen: boolean;
  onScannerOpenChange: (open: boolean) => void;
}) {
  const [pasteOpen, setPasteOpen] = useState(false);
  const [paste, setPaste] = useState('');

  const handleRaw = useCallback(
    async (raw: string): Promise<boolean> => {
      const p = parseSmartBoardQrClaimUrl(raw);
      if (!p) return false;
      try {
        await onClaim(p);
        setPaste('');
        onScannerOpenChange(false);
        return true;
      } catch {
        return false;
      }
    },
    [onClaim, onScannerOpenChange],
  );

  const submitPaste = async () => {
    const p = parseSmartBoardQrClaimUrl(paste);
    if (!p) {
      toast.error('Geçerli QR linki değil.');
      return;
    }
    await onClaim(p);
    setPaste('');
    setPasteOpen(false);
  };

  useEffect(() => {
    if (highlight) {
      document.getElementById('smart-board-qr-claim')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlight]);

  return (
    <>
      <div
        id="smart-board-qr-claim"
        className={cn(
          'mb-2 rounded-xl border border-violet-500/25 bg-violet-500/5 px-3 py-3 sm:mb-3 sm:border-violet-200/50 sm:bg-linear-to-br sm:from-violet-500/8 sm:via-background sm:to-teal-500/5 sm:p-4',
          highlight && 'ring-2 ring-violet-500/50',
        )}
      >
        {deviceHint ? (
          <p className="mb-2 text-[11px] text-violet-800 dark:text-violet-200">
            {SMART_BOARD_LESSON_SESSION_LABEL}: <strong>{deviceHint}</strong>
          </p>
        ) : null}

        {/* Masaüstü / tablet: büyük CTA */}
        <Button
          type="button"
          size="lg"
          className="hidden h-12 w-full gap-2 rounded-2xl bg-linear-to-r from-violet-600 to-teal-600 text-base font-semibold shadow-md sm:inline-flex"
          disabled={busy}
          onClick={() => onScannerOpenChange(true)}
        >
          <ScanLine className="size-5" />
          QR okut (tam ekran)
        </Button>

        <button
          type="button"
          className="flex w-full items-center justify-center gap-1 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          onClick={() => setPasteOpen((v) => !v)}
        >
          <ChevronDown className={cn('size-4 transition-transform', pasteOpen && 'rotate-180')} />
          Link yapıştır
        </button>

        {pasteOpen ? (
          <div className="mt-2 flex flex-col gap-2">
            <Input
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              placeholder="https://…/akilli-tahta?qr_school=…"
              className="h-9 text-xs"
            />
            <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => void submitPaste()}>
              <ClipboardPaste className="size-4" />
              Onayla
            </Button>
          </div>
        ) : null}

        {busy ? (
          <div className="mt-2 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <LoadingSpinner className="size-4" />
            Tahtaya bağlanıyor…
          </div>
        ) : null}
      </div>

      <TeacherQrScannerOverlay
        open={scannerOpen}
        onClose={() => onScannerOpenChange(false)}
        onDecoded={handleRaw}
        busy={busy}
        deviceHint={deviceHint}
      />
    </>
  );
}
