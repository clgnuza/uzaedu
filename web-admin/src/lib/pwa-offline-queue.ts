/** Çevrimdışı mutasyon kuyruğu + Background Sync tetikleme */

const DB_NAME = 'uzaedu-offline-v1';
const STORE = 'requests';
const SYNC_TAG = 'uzaedu-api-retry';
const PERIODIC_TAG = 'uzaedu-periodic-retry';

export type QueuedRequest = {
  id: string;
  path: string;
  apiBase: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
  createdAt: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idb<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error);
        t.oncomplete = () => db.close();
        t.onerror = () => {
          db.close();
          reject(t.error);
        };
      }),
  );
}

export function canQueueOfflineMethod(method: string): boolean {
  const m = method.toUpperCase();
  return m === 'POST' || m === 'PATCH' || m === 'PUT' || m === 'DELETE';
}

export function canQueueOfflinePath(path: string): boolean {
  const p = path.split('?')[0] ?? path;
  if (!p.startsWith('/')) return false;
  const blocked = [
    '/auth/login',
    '/auth/school/login',
    '/auth/register',
    '/auth/firebase-token',
    '/auth/webauthn',
    '/push/subscribe',
  ];
  return !blocked.some((b) => p === b || p.startsWith(`${b}/`));
}

export async function enqueueOfflineRequest(item: Omit<QueuedRequest, 'id' | 'createdAt'>): Promise<void> {
  const row: QueuedRequest = {
    ...item,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  };
  if ((row.body?.length ?? 0) > 64_000) return;
  await idb('readwrite', (s) => s.put(row));
  await registerBackgroundSync();
}

export async function listOfflineQueue(): Promise<QueuedRequest[]> {
  return idb('readonly', (s) => s.getAll());
}

export async function removeOfflineRequest(id: string): Promise<void> {
  await idb('readwrite', (s) => s.delete(id));
}

export async function registerBackgroundSync(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const regSync = reg as ServiceWorkerRegistration & {
      sync?: { register: (tag: string) => Promise<void> };
    };
    if (regSync.sync) {
      await regSync.sync.register(SYNC_TAG);
      try {
        const periodic = regSync as ServiceWorkerRegistration & {
          periodicSync?: { register: (tag: string, opts: { minInterval: number }) => Promise<void> };
        };
        if (periodic.periodicSync) {
          await periodic.periodicSync.register(PERIODIC_TAG, { minInterval: 12 * 60 * 60 * 1000 });
        }
      } catch {
        /* periodicSync izin gerekir */
      }
    }
  } catch {
    /* Sync API yok */
  }
}

export async function flushOfflineQueue(
  fetcher: (item: QueuedRequest) => Promise<boolean>,
): Promise<{ sent: number; failed: number }> {
  const items = await listOfflineQueue();
  let sent = 0;
  let failed = 0;
  for (const item of items.sort((a, b) => a.createdAt - b.createdAt)) {
    const ok = await fetcher(item);
    if (ok) {
      await removeOfflineRequest(item.id);
      sent += 1;
    } else {
      failed += 1;
    }
  }
  return { sent, failed };
}

export const OFFLINE_QUEUE_FLUSH_MESSAGE = 'uzaedu-flush-offline-queue';
