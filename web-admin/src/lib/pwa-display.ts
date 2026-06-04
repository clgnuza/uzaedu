/** PWA / ana ekran kurulumu görünüm modları */
export function isPwaDisplayMode(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;
  return ['standalone', 'fullscreen', 'minimal-ui'].some((mode) =>
    window.matchMedia(`(display-mode: ${mode})`).matches,
  );
}

export function isIosSafari(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
}
