/** Tek global beforeinstallprompt — çoklu preventDefault konsol uyarısını önler */

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice?: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Subscriber = (ready: boolean) => void;

let deferred: BeforeInstallPromptEvent | null = null;
let listenersBound = false;
const subscribers = new Set<Subscriber>();

function notify() {
  const ready = deferred != null;
  subscribers.forEach((fn) => fn(ready));
}

function bindOnce() {
  if (listenersBound || typeof window === 'undefined') return;
  listenersBound = true;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });

  window.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });
}

export function subscribePwaDeferredInstall(fn: Subscriber): () => void {
  bindOnce();
  fn(deferred != null);
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

export function isPwaDeferredInstallReady(): boolean {
  return deferred != null;
}

/** Kurulum diyaloğunu açar; olay tüketilir */
export async function promptPwaDeferredInstall(): Promise<void> {
  if (!deferred) return;
  const ev = deferred;
  deferred = null;
  notify();
  await ev.prompt();
}
