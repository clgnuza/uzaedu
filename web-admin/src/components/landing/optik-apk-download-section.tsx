'use client';

import { useMemo } from 'react';
import { AlertTriangle, Camera, Download, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OPTIK_NATIVE_APP_LABEL } from '@/lib/optik-native-deeplink';
import {
  OPTIK_APK_FILENAME,
  isOptikApkSideloadVisible,
  resolveOptikApkDownloadUrl,
} from '@/lib/optik-apk-url';
import type { MobileAppPublic } from '@/lib/mobile-config-public';
import { cn } from '@/lib/utils';
import { trackPwaEvent } from '@/lib/pwa-analytics';

const INSTALL_STEPS = [
  'APK indir',
  'Dosyayı aç → «Yine de yükle» (bilinmeyen kaynak izni gerekebilir)',
  'Kurulum bitince panelden optik taramayı tekrar açın',
] as const;

export function OptikApkDownloadSection({
  mobile,
  className,
}: {
  mobile: MobileAppPublic | null;
  className?: string;
}) {
  const apkUrl = useMemo(() => resolveOptikApkDownloadUrl(mobile), [mobile]);
  const visible = isOptikApkSideloadVisible(mobile);
  const version = mobile?.apk_version_label?.trim() || '1.0.0+1';
  const playUrl = mobile?.play_store_url?.trim();

  if (!visible || !apkUrl) return null;

  return (
    <section
      id="optik-apk"
      className={cn(
        'overflow-hidden rounded-2xl border border-fuchsia-500/25 bg-zinc-950/80 shadow-lg shadow-black/30',
        className,
      )}
    >
      <div className="border-b border-fuchsia-500/15 bg-linear-to-r from-fuchsia-600/15 via-zinc-950 to-zinc-950 px-4 py-4 sm:px-5">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-fuchsia-500/20 text-fuchsia-300">
            <Camera className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-fuchsia-300/90">
              Android · test dağıtımı
            </p>
            <h2 className="text-base font-bold text-white sm:text-lg">{OPTIK_NATIVE_APP_LABEL}</h2>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400">
              Optik tarama ve kamera native uygulamada. Panel PWA ayrıdır; APK yalnızca optik için.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3 px-4 py-4 sm:px-5">
        <p className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[11px] leading-snug text-amber-100/95">
          <AlertTriangle className="mr-1 inline size-3.5 align-text-bottom" aria-hidden />
          Test sürümü — yalnızca <strong className="font-semibold">uzaedu.com</strong> üzerinden indirin.
          Mağaza yayınından sonra Play Store linki kullanılacak.
        </p>

        <ol className="space-y-1.5">
          {INSTALL_STEPS.map((s, i) => (
            <li key={s} className="flex gap-2 text-[11px] text-zinc-300">
              <span className="flex size-5 shrink-0 items-center justify-center rounded bg-zinc-800 text-[10px] font-bold text-zinc-400">
                {i + 1}
              </span>
              {s}
            </li>
          ))}
        </ol>

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm" className="h-9 gap-1.5 bg-fuchsia-600 hover:bg-fuchsia-500">
            <a
              href={apkUrl}
              download={OPTIK_APK_FILENAME}
              onClick={() => trackPwaEvent('optik_apk_download_click', { version })}
            >
              <Download className="size-3.5" aria-hidden />
              APK indir
              {version ? <span className="opacity-80">({version})</span> : null}
            </a>
          </Button>
          {playUrl ? (
            <Button asChild variant="outline" size="sm" className="h-9 gap-1 border-white/15 text-zinc-200">
              <a href={playUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-3.5" aria-hidden />
                Play Store
              </a>
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
