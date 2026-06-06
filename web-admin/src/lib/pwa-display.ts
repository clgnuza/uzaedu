/** PWA / ana ekran kurulumu görünüm modları */
export function isPwaDisplayMode(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;
  return ['standalone', 'fullscreen', 'minimal-ui'].some((mode) =>
    window.matchMedia(`(display-mode: ${mode})`).matches,
  );
}

export function isIos(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
}

/** iOS Safari / Chrome iOS / Firefox iOS — hepsi WebKit */
export function isIosSafari(): boolean {
  return isIos();
}

export function isAndroid(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android/i.test(navigator.userAgent);
}

/** iOS 16.4+ PWA: push yalnızca ana ekrandan açılan uygulamada */
export function iosPushRequiresStandalone(): boolean {
  return isIos() && !isPwaDisplayMode();
}

export type PushPlatformHint =
  | null
  | 'ios_standalone'
  | 'ios_ok'
  | 'android_ok'
  | 'desktop_ok';

export function pushPlatformHint(): PushPlatformHint {
  if (isIos()) {
    return isPwaDisplayMode() ? 'ios_ok' : 'ios_standalone';
  }
  if (isAndroid()) return 'android_ok';
  if (typeof window !== 'undefined') return 'desktop_ok';
  return null;
}
