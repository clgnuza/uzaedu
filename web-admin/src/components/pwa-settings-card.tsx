'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Download, ExternalLink, Share2, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePwaDeferredInstall } from '@/hooks/use-pwa-deferred-install';
import { isIosSafari, isPwaDisplayMode } from '@/lib/pwa-display';
import { pushSupported } from '@/lib/web-push';
import { PwaOfflineQueueBadge } from '@/components/pwa-offline-queue-badge';
import { markPwaOnboardingPending } from '@/components/pwa-onboarding';
import { trackPwaEvent } from '@/lib/pwa-analytics';
import { cn } from '@/lib/utils';

export function PwaSettingsCard({ className }: { className?: string }) {
  const { canInstall, promptInstall } = usePwaDeferredInstall();
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    setInstalled(isPwaDisplayMode());
    setIos(isIosSafari());
    const onInstalled = () => setInstalled(true);
    window.addEventListener('appinstalled', onInstalled);
    return () => window.removeEventListener('appinstalled', onInstalled);
  }, []);

  if (!pushSupported()) return null;

  return (
    <section
      className={cn(
        'rounded-xl border border-border/60 bg-muted/15 p-3 sm:p-4',
        className,
      )}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Smartphone className="size-4 text-teal-600" />
        <h3 className="text-sm font-semibold">PWA uygulama</h3>
        <PwaOfflineQueueBadge />
        {installed ? (
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
            Kurulu
          </span>
        ) : null}
      </div>
      <p className="mb-3 text-xs text-muted-foreground leading-relaxed">
        Ana ekrandan tam ekran açılır; paylaşım menüsünden dosya/metin gönderebilirsiniz.
      </p>
      {!installed ? (
        <div className="flex flex-wrap gap-2">
          {canInstall ? (
            <Button
              type="button"
              size="sm"
              className="h-8 gap-1"
              onClick={() => {
                void promptInstall().then(() => markPwaOnboardingPending());
                trackPwaEvent('pwa_install_prompt', { source: 'settings' });
              }}
            >
              <Download className="size-3.5" />
              Ana ekrana ekle
            </Button>
          ) : null}
          {ios ? (
            <p className="text-[10px] text-muted-foreground">Safari → Paylaş → Ana Ekrana Ekle</p>
          ) : null}
          <Link
            href="/uygulama"
            className="inline-flex h-8 items-center gap-1 rounded-md border border-border/60 px-2.5 text-[11px] font-medium text-foreground hover:bg-muted/40"
          >
            <ExternalLink className="size-3" />
            Kurulum rehberi
          </Link>
        </div>
      ) : (
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Share2 className="size-3.5" />
          Dosya/görsel paylaşımı: sistem paylaş menüsü veya Uzaedu ile aç
        </p>
      )}
    </section>
  );
}
