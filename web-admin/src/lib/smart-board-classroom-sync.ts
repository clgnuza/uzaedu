/** Tahta tarayıcısı ↔ öğretmen paneli (aynı cihazda farklı sekmeler / PWA). */

export type ClassroomBoardSyncEvent =
  | { type: 'session_started'; teacher_name?: string | null }
  | { type: 'session_ended' }
  | { type: 'qr_unlocked' };

export function classroomBoardChannelKey(schoolId: string, deviceId: string) {
  return `ogretmenpro-classroom-${schoolId}-${deviceId}`;
}

export function postClassroomBoardSync(schoolId: string, deviceId: string, event: ClassroomBoardSyncEvent) {
  if (typeof window === 'undefined') return;
  const payload = { schoolId, deviceId, ...event };
  try {
    const ch = new BroadcastChannel(classroomBoardChannelKey(schoolId, deviceId));
    ch.postMessage(payload);
    ch.close();
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent('smart-board:classroom-sync', { detail: payload }));
}

export function subscribeClassroomBoardSync(
  schoolId: string,
  deviceId: string,
  handler: (event: ClassroomBoardSyncEvent) => void,
): () => void {
  if (typeof window === 'undefined') return () => undefined;

  const onCustom = (e: Event) => {
    const d = (e as CustomEvent<{ schoolId?: string; deviceId?: string; type?: string }>).detail;
    if (d?.schoolId !== schoolId || d?.deviceId !== deviceId || !d?.type) return;
    handler(d as ClassroomBoardSyncEvent);
  };

  let ch: BroadcastChannel | null = null;
  try {
    ch = new BroadcastChannel(classroomBoardChannelKey(schoolId, deviceId));
    ch.onmessage = (ev) => {
      const data = ev.data as { type?: string; teacher_name?: string | null };
      if (data?.type === 'session_started') handler({ type: 'session_started', teacher_name: data.teacher_name });
      else if (data?.type === 'session_ended') handler({ type: 'session_ended' });
      else if (data?.type === 'qr_unlocked') handler({ type: 'qr_unlocked' });
    };
  } catch {
    /* ignore */
  }

  window.addEventListener('smart-board:classroom-sync', onCustom);
  return () => {
    ch?.close();
    window.removeEventListener('smart-board:classroom-sync', onCustom);
  };
}
