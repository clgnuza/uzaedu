/** Ana ekran ikon rozeti (Badging API) */
export function appBadgeSupported(): boolean {
  return typeof navigator !== 'undefined' && 'setAppBadge' in navigator;
}

export async function syncAppBadge(count: number): Promise<void> {
  if (!appBadgeSupported()) return;
  const nav = navigator as Navigator & {
    setAppBadge?: (n: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  try {
    if (count > 0) await nav.setAppBadge!(Math.min(99, count));
    else await nav.clearAppBadge!();
  } catch {
    /* ignore */
  }
}
