'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Share2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  peekShareFiles,
  takeShareFiles,
  takeShareTarget,
  type ShareTargetModule,
} from '@/lib/pwa-share-intake';
import { toast } from 'sonner';

export function PwaShareBanner({
  expect,
  onImportOptik,
  optikImportLabel = 'Paylaşılan görseli tara',
}: {
  expect: ShareTargetModule;
  onImportOptik?: () => void | Promise<void>;
  optikImportLabel?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (searchParams.get('from_share') !== '1') return;
    const target = takeShareTarget();
    if (target && target !== expect) return;
    void peekShareFiles().then((files) => {
      if (files.length > 0) {
        setCount(files.length);
        setOpen(true);
      }
    });
    if (expect === 'mesaj') {
      try {
        const draft = sessionStorage.getItem('pwa-mesaj-draft');
        if (draft) {
          setOpen(true);
          toast.message('Paylaşılan metin mesaj taslağına eklenebilir', { description: draft.slice(0, 120) });
          sessionStorage.removeItem('pwa-mesaj-draft');
        }
      } catch {
        /* ignore */
      }
    }
  }, [searchParams, expect]);

  if (!open) return null;

  return (
    <div className="mb-3 flex items-start gap-2 rounded-xl border border-teal-500/30 bg-teal-500/10 px-3 py-2">
      <Share2 className="mt-0.5 size-4 shrink-0 text-teal-700 dark:text-teal-300" />
      <div className="min-w-0 flex-1 text-xs">
        <p className="font-medium text-foreground">
          {count > 0 ? `${count} paylaşılan dosya bekliyor` : 'Paylaşılan içerik'}
        </p>
        <p className="mt-0.5 text-muted-foreground">Modül içinden yüklemeyi tamamlayın; dosyalar hazır tutuldu.</p>
      </div>
      <div className="flex shrink-0 flex-col gap-1">
        {expect === 'optik' && onImportOptik && count > 0 ? (
          <Button type="button" size="sm" className="h-7 text-[10px]" onClick={() => void onImportOptik()}>
            {optikImportLabel}
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-7 text-[10px]"
          onClick={() => {
            if (expect !== 'optik' || !onImportOptik) void takeShareFiles();
            setOpen(false);
            const path = window.location.pathname;
            router.replace(path);
          }}
        >
          {expect === 'optik' && onImportOptik ? 'Sonra' : 'Anladım'}
        </Button>
      </div>
      <button
        type="button"
        className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted"
        aria-label="Kapat"
        onClick={() => setOpen(false)}
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
