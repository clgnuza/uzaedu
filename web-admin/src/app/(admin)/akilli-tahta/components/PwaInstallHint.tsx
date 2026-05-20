'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
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
    <Card className="mb-3 border-sky-300/40 bg-sky-500/5 sm:mb-4">
      <CardContent className="flex gap-3 py-3">
        <Smartphone className="size-5 shrink-0 text-sky-600" />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-medium">Telefondan QR onayı (PWA)</p>
          <p className="text-xs text-muted-foreground">
            {ios
              ? 'Safari → Paylaş → Ana Ekrana Ekle. Aynı hesapla bu sayfada kamera veya bildirim linki.'
              : deferred
                ? 'Ana ekrana ekleyin; tahtadaki QR’ı kamera ile okutun veya bildirimden «QR okut».'
                : 'Chrome → Uygulamayı yükle / Ana ekrana ekle. Sonra üstteki QR panelini kullanın.'}
          </p>
          {deferred ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                void deferred.prompt();
                dismiss();
              }}
            >
              Ana ekrana ekle
            </Button>
          ) : null}
        </div>
        <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0" onClick={dismiss} aria-label="Kapat">
          <X className="size-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}
