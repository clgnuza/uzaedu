'use client';

import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import {
  openOptikNativeScan,
  OPTIK_NATIVE_APP_LABEL,
  type OptikNativeScanMode,
  type OptikNativeScanParams,
} from '@/lib/optik-native-deeplink';
import { setOptikScanSurfacePwaOverride } from '@/lib/optik-scan-surface';
import Link from 'next/link';
import { Camera, ExternalLink, Smartphone } from 'lucide-react';

type ScanAction = {
  mode: OptikNativeScanMode;
  label: string;
  title?: string;
  disabled?: boolean;
};

export function OptikNativeScanPanel({
  ready,
  base,
  actions,
  onEnablePwaCamera,
}: {
  ready: boolean;
  base: Omit<OptikNativeScanParams, 'mode'>;
  actions: ScanAction[];
  /** Geliştirici: tarayıcı kamerasına geç */
  onEnablePwaCamera?: () => void;
}) {
  const [hint, setHint] = useState<string | null>(null);

  const openNative = useCallback(
    (mode: OptikNativeScanMode) => {
      setHint(null);
      openOptikNativeScan({ ...base, mode });
      window.setTimeout(() => {
        setHint(
          `${OPTIK_NATIVE_APP_LABEL} yüklü değilse /uygulama#optik-apk üzerinden APK indirin (Android) veya tarayıcı taramasını açın.`,
        );
      }, 1200);
    },
    [base],
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-fuchsia-500/25 bg-card shadow-sm">
      <div className="border-b border-fuchsia-500/15 bg-linear-to-r from-fuchsia-500/10 via-violet-500/8 to-transparent px-3 py-2.5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Smartphone className="size-4 text-fuchsia-600" />
          Mobil tarama
        </h2>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Optik okuma native uygulamada — net kamera ve OMR
        </p>
      </div>
      <div className="space-y-2 p-3">
        {actions.map((a) => (
          <Button
            key={a.mode}
            type="button"
            title={a.title ?? a.label}
            disabled={!ready || a.disabled}
            className="h-11 w-full justify-start gap-2 rounded-xl bg-linear-to-r from-fuchsia-600 to-violet-600 text-sm font-semibold"
            onClick={() => openNative(a.mode)}
          >
            <Camera className="size-4 shrink-0 opacity-90" />
            {a.label}
            <ExternalLink className="ml-auto size-3.5 opacity-70" />
          </Button>
        ))}
        {hint ? (
          <Alert variant="warning" className="text-xs">
            {hint}
            <Link href="/uygulama#optik-apk" className="mt-2 block font-medium text-fuchsia-700 underline dark:text-fuchsia-300">
              Android APK indir
            </Link>
            {onEnablePwaCamera ? (
              <button
                type="button"
                className="mt-2 block font-medium underline"
                onClick={() => {
                  setOptikScanSurfacePwaOverride(true);
                  onEnablePwaCamera();
                }}
              >
                Tarayıcıda tara (geliştirici)
              </button>
            ) : null}
          </Alert>
        ) : null}
      </div>
    </section>
  );
}
