/** Tahta / panel QR linkinden claim parametreleri. */
export type SmartBoardQrClaimParams = {
  school_id: string;
  device_id: string;
  session_id: string;
  code: string;
};

export function parseSmartBoardQrClaimUrl(raw: string): SmartBoardQrClaimParams | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    const url = t.includes('://') ? new URL(t) : new URL(t.startsWith('/') ? t : `/${t}`, 'https://local.invalid');
    const p = url.searchParams;
    const school_id = (p.get('qr_school') ?? p.get('school_id') ?? '').trim();
    const device_id = (p.get('qr_device') ?? p.get('device_id') ?? '').trim();
    const session_id = (p.get('qr_session') ?? p.get('session_id') ?? '').trim();
    const code = (p.get('qr_code') ?? p.get('code') ?? '').trim();
    if (!school_id || !device_id || !session_id || !code) return null;
    return { school_id, device_id, session_id, code };
  } catch {
    return null;
  }
}
