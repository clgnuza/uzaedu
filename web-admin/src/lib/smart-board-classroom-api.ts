import { getApiUrl } from '@/lib/api';

export function buildClassroomQrImageSrc(panelLink: string): string {
  return `${getApiUrl('/tv/classroom-qr-image')}?url=${encodeURIComponent(panelLink)}`;
}

export type QrPollResult = {
  approved?: boolean;
  expired?: boolean;
  exchange_nonce?: string;
  exchange_expires_in?: number;
  exchanged?: boolean;
  teacher_name?: string | null;
};

export async function exchangeClassroomUnlock(args: {
  schoolId: string;
  deviceId: string;
  sessionId: string;
  exchangeNonce: string;
}): Promise<{ access_token: string; expires_in?: number; teacher_name?: string | null }> {
  const res = await fetch(getApiUrl('/tv/classroom-unlock-exchange'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      school_id: args.schoolId,
      device_id: args.deviceId,
      session_id: args.sessionId,
      exchange_nonce: args.exchangeNonce,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    message?: string;
    code?: string;
    access_token?: string;
  };
  if (!res.ok || !body.access_token) {
    const err = new Error(body.message || 'Tahta token alınamadı') as Error & { code?: string };
    err.code = body.code;
    throw err;
  }
  return body as { access_token: string; expires_in?: number; teacher_name?: string | null };
}

export async function pollClassroomQrSession(args: {
  schoolId: string;
  deviceId: string;
  sessionId: string;
}): Promise<QrPollResult | null> {
  const res = await fetch(
    getApiUrl(
      `/tv/classroom-qr-session/${encodeURIComponent(args.sessionId)}/poll?school_id=${encodeURIComponent(args.schoolId)}&device_id=${encodeURIComponent(args.deviceId)}`,
    ),
  );
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { code?: string; message?: string };
    const err = new Error(body.message || 'QR poll başarısız') as Error & { code?: string };
    err.code = body.code;
    throw err;
  }
  return (await res.json()) as QrPollResult;
}

export type QrPollUnlockResult = 'pending' | 'expired' | 'unlocked' | 'error';

export function classroomTvErrorMessage(code?: string, fallback?: string): string {
  switch (code) {
    case 'TV_IP_NOT_CONFIGURED':
      return 'TV izinli IP listesi tanımlı değil. Panel → Duyuru TV’den okul ağını ekleyin.';
    case 'TV_ACCESS_RESTRICTED':
      return 'Bu istek okul ağı dışından geliyor. İzinli IP listesini kontrol edin.';
    case 'TV_RATE_LIMIT':
      return 'Çok fazla istek. Biraz bekleyip QR’ı yenileyin.';
    case 'QR_EXCHANGE_EXPIRED':
    case 'QR_EXCHANGE_INVALID':
      return 'QR onay süresi doldu. Tahtada yeni QR oluşturun.';
    case 'QR_ALREADY_EXCHANGED':
      return 'Bağlantı zaten kuruldu.';
    default:
      return fallback || 'Tahta bağlantısı kurulamadı.';
  }
}

/** Poll → exchange (token poll yanıtında yok). */
export async function tryUnlockFromQrPoll(args: {
  schoolId: string;
  deviceId: string;
  sessionId: string;
  onUnlocked: (token: string) => void;
  exchangingRef?: { current: boolean } | null;
}): Promise<QrPollUnlockResult> {
  let body: QrPollResult | null;
  try {
    body = await pollClassroomQrSession(args);
  } catch (e) {
    const code = (e as Error & { code?: string }).code;
    throw Object.assign(e instanceof Error ? e : new Error(String(e)), { code });
  }
  if (!body) return 'pending';
  if (body.expired) return 'expired';
  if (body.approved && body.exchange_nonce) {
    if (args.exchangingRef?.current) return 'pending';
    if (args.exchangingRef) args.exchangingRef.current = true;
    try {
      const ex = await exchangeClassroomUnlock({
        schoolId: args.schoolId,
        deviceId: args.deviceId,
        sessionId: args.sessionId,
        exchangeNonce: body.exchange_nonce,
      });
      args.onUnlocked(ex.access_token);
      return 'unlocked';
    } catch (e) {
      const code = (e as Error & { code?: string }).code;
      throw Object.assign(e instanceof Error ? e : new Error(String(e)), { code });
    } finally {
      if (args.exchangingRef) args.exchangingRef.current = false;
    }
  }
  if (body.approved && body.exchanged) {
    try {
      const key = `tv_usb_${args.schoolId}_${args.deviceId}`;
      const t = sessionStorage.getItem(key);
      if (t) args.onUnlocked(t);
    } catch {
      /* ignore */
    }
  }
  return 'pending';
}
