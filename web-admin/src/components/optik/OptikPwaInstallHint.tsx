'use client';

import { Smartphone } from 'lucide-react';
import { getOptikScanSurface } from '@/lib/optik-scan-surface';

/** PWA kurulumu ile mobil tarama ayrımı */
export function OptikPwaInstallHint() {
  if (getOptikScanSurface() !== 'native') return null;
  return (
    <p className="flex items-start gap-2 rounded-xl border border-muted/60 bg-muted/30 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
      <Smartphone className="mt-0.5 size-3.5 shrink-0 text-fuchsia-600" />
      <span>
        <strong className="text-foreground">PWA yüklemeye devam edebilirsiniz</strong> — ders programı,
        rapor, ayar burada. Optik form <strong className="text-foreground">taraması</strong> native
        uygulamada (daha net kamera + 5 kare OMR).
      </span>
    </p>
  );
}
