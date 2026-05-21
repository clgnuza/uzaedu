import type { SessionScanPayload } from '@/lib/optik-sessions-api';

const STORAGE_KEY = 'optik_offline_scan_queue_v1';

export type OfflineQueuedScan = {
  id: string;
  sessionId: string;
  body: SessionScanPayload;
  createdAt: string;
  retries: number;
};

function readAll(): OfflineQueuedScan[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as OfflineQueuedScan[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(items: OfflineQueuedScan[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 200)));
}

export function listOfflineScans(sessionId?: string): OfflineQueuedScan[] {
  const all = readAll();
  if (!sessionId) return all;
  return all.filter((x) => x.sessionId === sessionId);
}

export function enqueueOfflineScan(sessionId: string, body: SessionScanPayload) {
  const item: OfflineQueuedScan = {
    id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    sessionId,
    body,
    createdAt: new Date().toISOString(),
    retries: 0,
  };
  writeAll([item, ...readAll()]);
  return item.id;
}

export function removeOfflineScan(id: string) {
  writeAll(readAll().filter((x) => x.id !== id));
}

export async function flushOfflineQueue(
  token: string,
  post: (sessionId: string, body: SessionScanPayload) => Promise<unknown>,
): Promise<{ ok: number; fail: number }> {
  let ok = 0;
  let fail = 0;
  const items = [...readAll()].reverse();
  for (const item of items) {
    try {
      await post(item.sessionId, item.body);
      removeOfflineScan(item.id);
      ok++;
    } catch {
      const all = readAll();
      const idx = all.findIndex((x) => x.id === item.id);
      if (idx >= 0) {
        all[idx] = { ...all[idx], retries: all[idx].retries + 1 };
        writeAll(all);
      }
      fail++;
    }
  }
  return { ok, fail };
}
