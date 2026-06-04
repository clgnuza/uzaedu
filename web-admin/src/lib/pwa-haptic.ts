import { isPwaDisplayMode } from './pwa-display';

export function hapticTap(): void {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  if (!isPwaDisplayMode()) return;
  try {
    navigator.vibrate(12);
  } catch {
    /* ignore */
  }
}

export function hapticSuccess(): void {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  if (!isPwaDisplayMode()) return;
  try {
    navigator.vibrate([15, 40, 20]);
  } catch {
    /* ignore */
  }
}
