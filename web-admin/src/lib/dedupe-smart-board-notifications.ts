/** Inbox: aynı tahta için birden fazla smart_board.qr_pending satırını tekilleştir (en yeni kalır). */
export function dedupeSmartBoardQrPending<T extends {
  id: string;
  event_type: string;
  created_at: string;
  metadata?: { device_id?: string } | null;
}>(items: T[]): T[] {
  const latestQrByDevice = new Map<string, T>();
  const out: T[] = [];
  for (const item of items) {
    if (item.event_type !== 'smart_board.qr_pending') {
      out.push(item);
      continue;
    }
    const deviceId = item.metadata?.device_id;
    if (!deviceId) {
      out.push(item);
      continue;
    }
    const prev = latestQrByDevice.get(deviceId);
    if (!prev || item.created_at > prev.created_at) {
      latestQrByDevice.set(deviceId, item);
    }
  }
  const qrDeduped = [...latestQrByDevice.values()];
  const merged = [...out, ...qrDeduped];
  merged.sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
  return merged;
}
