'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Smartphone, X } from 'lucide-react';

export function PwaInstallHint() {
  const [dismissed, setDismissed] = useState(false);
  const [deferred, setDeferred] = useState<{ prompt: () => Promise<void> } | null>(null);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (localStorage.getItem('pwa-hint-dismissed') === '1') setDismissed(true);
    } catch {
      /* ignore */
    }
    const ua = navigator.userAgent;
    setIos(/iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred({ prompt: () => (e as BeforeInstallPromptEvent).prompt() });
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem('pwa-hint-dismissed', '1');
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="mb-2 flex items-start gap-2 rounded-lg border border-sky-500/25 bg-sky-500/8 px-2.5 py-2 sm:mb-3">
      <Smartphone className="mt-0.5 size-4 shrink-0 text-sky-600" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium leading-snug">Ana ekrana ekleyin (hızlı QR)</p>
        <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
          {ios
            ? 'Safari → Paylaş → Ana Ekrana Ekle'
            : deferred
              ? 'Uygulamayı yükleyin; bildirimden tek dokunuşla QR açılır.'
              : 'Chrome menü → Ana ekrana ekle'}
        </p>
        {deferred ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="mt-1.5 h-7 text-[10px]"
            onClick={() => {
              void deferred.prompt();
              dismiss();
            }}
          >
            Yükle
          </Button>
        ) : null}
      </div>
      <Button type="button" variant="ghost" size="icon" className="size-7 shrink-0" onClick={dismiss} aria-label="Kapat">
        <X className="size-3.5" />
      </Button>
    </div>
  );
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}
