'use client';

import { useCallback, useState } from 'react';
import { getOptikScanSurface, setOptikScanSurfacePwaOverride, type OptikScanSurface } from '@/lib/optik-scan-surface';

export function useOptikScanSurface() {
  const [surface, setSurface] = useState<OptikScanSurface>(() => getOptikScanSurface());
  const enablePwaCamera = useCallback(() => {
    setOptikScanSurfacePwaOverride(true);
    setSurface('pwa');
  }, []);
  return {
    surface,
    isNative: surface === 'native',
    isPwa: surface === 'pwa',
    enablePwaCamera,
  };
}
