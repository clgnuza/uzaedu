/** Bildirim / banner → Akıllı Tahta (QR paneli odaklı). */
export function smartBoardNotificationHref(item: {
  event_type?: string;
  metadata?: Record<string, unknown> | null;
}): string {
  if (item.event_type !== 'smart_board.qr_pending') return '/akilli-tahta';
  const m = item.metadata ?? {};
  const params = new URLSearchParams({ open_qr: '1' });
  const schoolId = String(m.school_id ?? '').trim();
  const deviceId = String(m.device_id ?? '').trim();
  const sessionId = String(m.session_id ?? '').trim();
  if (schoolId) params.set('qr_school', schoolId);
  if (deviceId) params.set('qr_device', deviceId);
  if (sessionId) params.set('qr_session', sessionId);
  const qrCode = String(m.qr_code ?? '').trim();
  if (qrCode) params.set('qr_code', qrCode);
  return `/akilli-tahta?${params.toString()}`;
}
