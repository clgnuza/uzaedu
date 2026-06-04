/** Optik tarama yüzeyi: native (Flutter) veya pwa (tarayıcı kamerası). */

export type OptikScanSurface = 'native' | 'pwa';

const STORAGE_OVERRIDE = 'optik_scan_surface_pwa';

export function getOptikScanSurface(): OptikScanSurface {
  const env = process.env.NEXT_PUBLIC_OPTIK_SCAN_SURFACE?.trim().toLowerCase();
  if (env === 'pwa') return 'pwa';
  if (env === 'native') return 'native';
  if (typeof window !== 'undefined' && localStorage.getItem(STORAGE_OVERRIDE) === '1') {
    return 'pwa';
  }
  return 'native';
}

export function setOptikScanSurfacePwaOverride(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  if (enabled) localStorage.setItem(STORAGE_OVERRIDE, '1');
  else localStorage.removeItem(STORAGE_OVERRIDE);
}
