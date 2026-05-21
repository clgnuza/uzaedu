/** Inbox: aynı tahta için birden fazla smart_board.qr_pending satırını tekilleştir (en yeni kalır). */
export function dedupeSmartBoardQrPending<T extends {
  id: string;
  event_type?: string;
  created_at?: string;
  metadata?: Record<string, unknown> | null;
}>(items: T[]): T[] {
  const latestQrByDevice = new Map<string, T>();
  const out: T[] = [];
  for (const item of items) {
    if (item.event_type !== 'smart_board.qr_pending') {
      out.push(item);
      continue;
    }
    const deviceId =
      item.metadata && typeof item.metadata.device_id === 'string' ? item.metadata.device_id : undefined;
    if (!deviceId) {
      out.push(item);
      continue;
    }
    const prev = latestQrByDevice.get(deviceId);
    const at = item.created_at ?? '';
    const pt = prev?.created_at ?? '';
    if (!prev || at > pt) {
      latestQrByDevice.set(deviceId, item);
    }
  }
  const qrDeduped = [...latestQrByDevice.values()];
  const merged = [...out, ...qrDeduped];
  merged.sort((a, b) => {
    const ca = a.created_at ?? '';
    const cb = b.created_at ?? '';
    return ca < cb ? 1 : ca > cb ? -1 : 0;
  });
  return merged;
}
