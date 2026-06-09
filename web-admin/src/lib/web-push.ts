import { apiFetch } from '@/lib/api';
import { evaluatePushDeviceSupport, pushBlockMessage, type PushBlockReason } from '@/lib/push-platform-guide';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

const SW_URL =
  typeof process !== 'undefined' && process.env.NODE_ENV === 'development' ? '/sw-push.js' : '/sw.js';
const SW_READY_MS = 25_000;
const PERMISSION_MS = 12_000;

export type PushSubscribeReason =
  | 'unsupported'
  | 'ios_standalone'
  | 'ios_old_version'
  | 'ios_other_browser'
  | 'firefox_android'
  | 'huawei_gms'
  | 'denied'
  | 'server'
  | 'sw'
  | 'invalid'
  | 'subscribe_failed'
  | 'api_failed';

function blockReasonToSubscribeReason(reason: PushBlockReason): PushSubscribeReason {
  if (reason === 'unsupported') return 'unsupported';
  return reason;
}

export type PushDeviceSnapshot = {
  permission: NotificationPermission;
  localSubscribed: boolean;
  endpoint: string | null;
  canSubscribe: boolean;
  blockReason: PushSubscribeReason | null;
};

export type PushStatusResponse = {
  subscribed: boolean;
  thisDevice: boolean;
  deviceCount: number;
  pushEnabled: boolean;
};

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

function registrationScriptUrl(reg: ServiceWorkerRegistration): string {
  return reg.active?.scriptURL ?? reg.waiting?.scriptURL ?? reg.installing?.scriptURL ?? '';
}

async function purgeNonPushWorkers(): Promise<void> {
  const all = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    all.filter((r) => !registrationScriptUrl(r).includes('sw-push')).map((r) => r.unregister()),
  );
}

async function waitForActive(reg: ServiceWorkerRegistration): Promise<ServiceWorkerRegistration> {
  if (reg.active) return reg;

  const worker = reg.installing ?? reg.waiting;
  if (worker) {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('sw-install-timeout')), SW_READY_MS);
      const check = () => {
        if (reg.active) {
          clearTimeout(timer);
          resolve();
          return;
        }
        if (worker.state === 'redundant') {
          clearTimeout(timer);
          reject(new Error('sw-redundant'));
        }
      };
      worker.addEventListener('statechange', check);
      check();
      if (worker.state === 'installed' && reg.waiting) {
        try {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        } catch {
          /* ignore */
        }
      }
    });
    if (reg.active) return reg;
  }

  await withTimeout(navigator.serviceWorker.ready, SW_READY_MS);
  return reg;
}

async function ensurePushServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  const isDevPush = SW_URL.includes('sw-push');
  try {
    if (isDevPush) {
      await purgeNonPushWorkers();
    } else {
      const reg = await navigator.serviceWorker.getRegistration('/');
      if (reg && !registrationScriptUrl(reg).includes('sw.js')) {
        await reg.unregister();
      }
    }
    let reg = await navigator.serviceWorker.getRegistration('/');
    if (!reg || (isDevPush && !registrationScriptUrl(reg).includes('sw-push'))) {
      reg = await navigator.serviceWorker.register(SW_URL, { scope: '/', updateViaCache: 'none' });
    }
    reg = await waitForActive(reg);
    return reg.active ? reg : null;
  } catch {
    try {
      if (isDevPush) await purgeNonPushWorkers();
      else {
        const stale = await navigator.serviceWorker.getRegistration('/');
        if (stale) await stale.unregister();
      }
      const reg = await navigator.serviceWorker.register(SW_URL, { scope: '/', updateViaCache: 'none' });
      const ready = await waitForActive(reg);
      return ready.active ? ready : null;
    } catch {
      return null;
    }
  }
}

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function canSubscribePushOnDevice(): { ok: boolean; reason?: PushSubscribeReason } {
  const eval_ = evaluatePushDeviceSupport({ pushApiAvailable: pushSupported() });
  if (!eval_.canSubscribe) {
    return { ok: false, reason: blockReasonToSubscribeReason(eval_.blockReason ?? 'unsupported') };
  }
  return { ok: true };
}

export function getNotificationPermission(): NotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'denied';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!pushSupported()) return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try {
    return await withTimeout(Notification.requestPermission(), PERMISSION_MS);
  } catch {
    return getNotificationPermission();
  }
}

export async function getLocalPushSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  try {
    const reg = await ensurePushServiceWorker();
    if (!reg) return null;
    return reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

export async function getPushDeviceSnapshot(): Promise<PushDeviceSnapshot> {
  const permission = getNotificationPermission();
  const gate = canSubscribePushOnDevice();
  const sub = permission === 'granted' ? await getLocalPushSubscription() : null;
  return {
    permission,
    localSubscribed: Boolean(sub),
    endpoint: sub?.endpoint ?? null,
    canSubscribe: gate.ok,
    blockReason: gate.ok ? null : (gate.reason ?? 'unsupported'),
  };
}

export async function fetchPushStatus(token: string, endpoint?: string | null): Promise<PushStatusResponse> {
  const q = endpoint ? `?endpoint=${encodeURIComponent(endpoint)}` : '';
  return apiFetch<PushStatusResponse>(`/push/status${q}`, { token });
}

export async function fetchVapidPublicKey(): Promise<string | null> {
  const res = await apiFetch<{ publicKey: string | null; enabled: boolean }>('/push/vapid-public-key');
  if (!res.enabled || !res.publicKey) return null;
  return res.publicKey;
}

export async function subscribeWebPush(
  token: string,
  opts?: { skipPermissionRequest?: boolean },
): Promise<{ ok: boolean; reason?: PushSubscribeReason; message?: string }> {
  const gate = canSubscribePushOnDevice();
  if (!gate.ok) return { ok: false, reason: gate.reason ?? 'unsupported' };

  if (!opts?.skipPermissionRequest) {
    const permission = await requestNotificationPermission();
    if (permission !== 'granted') return { ok: false, reason: 'denied' };
  } else if (getNotificationPermission() !== 'granted') {
    return { ok: false, reason: 'denied' };
  }

  const publicKey = await fetchVapidPublicKey();
  if (!publicKey) return { ok: false, reason: 'server', message: 'VAPID yapılandırması yok' };

  const reg = await ensurePushServiceWorker();
  if (!reg) return { ok: false, reason: 'sw' };

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    try {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
    } catch (e) {
      const name = e instanceof DOMException ? e.name : '';
      if (name === 'NotAllowedError' || name === 'NotSupportedError') {
        return { ok: false, reason: 'denied' };
      }
      return { ok: false, reason: 'subscribe_failed', message: e instanceof Error ? e.message : undefined };
    }
  }

  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    return { ok: false, reason: 'invalid' };
  }

  try {
    const res = await apiFetch<{ ok: boolean; message?: string }>('/push/subscribe', {
      token,
      method: 'POST',
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      }),
    });
    if (!res?.ok) {
      return { ok: false, reason: 'api_failed', message: res?.message ?? 'Sunucu kaydı başarısız' };
    }
  } catch (e) {
    return {
      ok: false,
      reason: 'api_failed',
      message: e instanceof Error ? e.message : 'Sunucu kaydı başarısız',
    };
  }

  return { ok: true };
}

export async function unsubscribeWebPush(token: string): Promise<void> {
  const reg = await ensurePushServiceWorker();
  if (!reg) return;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await apiFetch('/push/subscribe', {
      token,
      method: 'DELETE',
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
    await sub.unsubscribe();
  }
}

/** İzin verilmiş ama cihaz aboneliği eksikse sunucuya yeniden kaydet */
export async function repairPushSubscriptionIfNeeded(token: string): Promise<{ ok: boolean; reason?: PushSubscribeReason }> {
  if (getNotificationPermission() !== 'granted') return { ok: false, reason: 'denied' };
  const sub = await getLocalPushSubscription();
  if (!sub) {
    return subscribeWebPush(token, { skipPermissionRequest: true });
  }
  try {
    const status = await fetchPushStatus(token, sub.endpoint);
    if (status.thisDevice) return { ok: true };
  } catch {
    /* sunucu yanıt vermezse yine de kaydetmeyi dene */
  }
  return subscribeWebPush(token, { skipPermissionRequest: true });
}

export function pushReasonMessage(reason: PushSubscribeReason | undefined, message?: string): string {
  switch (reason) {
    case 'ios_standalone':
    case 'ios_old_version':
    case 'ios_other_browser':
    case 'firefox_android':
    case 'huawei_gms':
      return pushBlockMessage(reason);
    case 'denied':
      return 'Bildirim izni verilmedi. Tarayıcı/site ayarlarından izin verin.';
    case 'server':
      return 'Sunucuda push yapılandırılmamış.';
    case 'sw':
      return 'Service worker hazır değil. Sayfayı yenileyin (Ctrl+Shift+R). Emülatörde yalnızca localhost:3000 kullanın; takılı kalırsa Chrome site verisini temizleyin.';
    case 'subscribe_failed':
      return message ?? 'Push aboneliği oluşturulamadı.';
    case 'api_failed':
      return message ?? 'Sunucuya kayıt yapılamadı.';
    case 'invalid':
      return 'Geçersiz push aboneliği.';
    case 'unsupported':
    default:
      return 'Bu tarayıcı push bildirimini desteklemiyor.';
  }
}
