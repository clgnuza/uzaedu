import { getApiUrl } from '@/lib/api';

/** Backend: 180 istek / 15 dk → güvenli aralık */
export const CLASSROOM_QR_POLL_INTERVAL_MS = 5000;

export type CachedClassroomQrSession = {
  session_id: string;
  code: string;
  expires_at_ms: number;
};

export function classroomQrCacheKey(schoolId: string, deviceId: string) {
  return `tv_qr_session_${schoolId}_${deviceId}`;
}

export function readCachedClassroomQrSession(
  schoolId: string,
  deviceId: string,
): CachedClassroomQrSession | null {
  try {
    const raw = sessionStorage.getItem(classroomQrCacheKey(schoolId, deviceId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedClassroomQrSession;
    if (!parsed.session_id || !parsed.code || !parsed.expires_at_ms) return null;
    if (parsed.expires_at_ms <= Date.now() + 1500) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeCachedClassroomQrSession(
  schoolId: string,
  deviceId: string,
  session: CachedClassroomQrSession,
) {
  try {
    sessionStorage.setItem(classroomQrCacheKey(schoolId, deviceId), JSON.stringify(session));
  } catch {
    /* ignore */
  }
}

export function clearCachedClassroomQrSession(schoolId: string, deviceId: string) {
  try {
    sessionStorage.removeItem(classroomQrCacheKey(schoolId, deviceId));
  } catch {
    /* ignore */
  }
}

export async function createClassroomQrSession(args: {
  schoolId: string;
  deviceId: string;
}): Promise<{ session_id: string; code: string; expires_in: number }> {
  const cached = readCachedClassroomQrSession(args.schoolId, args.deviceId);
  if (cached) {
    return {
      session_id: cached.session_id,
      code: cached.code,
      expires_in: Math.max(1, Math.floor((cached.expires_at_ms - Date.now()) / 1000)),
    };
  }
  const res = await fetch(getApiUrl('/tv/classroom-qr-session'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ school_id: args.schoolId, device_id: args.deviceId }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    session_id?: string;
    code?: string;
    expires_in?: number;
    message?: string;
  };
  if (!res.ok || !body.session_id || !body.code) {
    const err = new Error(body.message || 'QR oluşturulamadı') as Error & { code?: string };
    if (!body.session_id && typeof body.code === 'string' && body.code.includes('_')) {
      err.code = body.code;
    }
    throw err;
  }
  const expiresIn = body.expires_in ?? 120;
  writeCachedClassroomQrSession(args.schoolId, args.deviceId, {
    session_id: body.session_id,
    code: body.code,
    expires_at_ms: Date.now() + expiresIn * 1000,
  });
  return { session_id: body.session_id, code: body.code, expires_in: expiresIn };
}

export function buildClassroomQrImageSrc(panelLink: string, opts?: { px?: number }) {
  const q = new URLSearchParams({ url: panelLink });
  if (opts?.px && opts.px > 0) q.set('size', String(Math.round(opts.px)));
  return `${getApiUrl('/tv/classroom-qr-image')}?${q.toString()}`;
}

export type QrPollResult = {
  approved?: boolean;
  expired?: boolean;
  exchange_nonce?: string;
  exchange_expires_in?: number;
  exchanged?: boolean;
  teacher_name?: string | null;
  takeover_pending?: boolean;
  takeover_seconds_left?: number;
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

export type QrPollUnlockResult = 'pending' | 'expired' | 'unlocked' | 'error' | 'takeover_pending';

export function classroomTvErrorMessage(code?: string, fallback?: string): string {
  switch (code) {
    case 'TV_IP_NOT_CONFIGURED':
      return 'TV IP kısıtı tanımlı değil (eski sunucu). Liste boş bırakılabilir; güncel sürümde zorunlu değil.';
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
  onTakeoverPending?: (info: { seconds_left: number; teacher_name: string | null }) => void;
}): Promise<QrPollUnlockResult> {
  let body: QrPollResult | null;
  try {
    body = await pollClassroomQrSession(args);
  } catch (e) {
    const code = (e as Error & { code?: string }).code;
    throw Object.assign(e instanceof Error ? e : new Error(String(e)), { code });
  }
  if (!body) return 'pending';
  if (body.takeover_pending) {
    args.onTakeoverPending?.({
      seconds_left: body.takeover_seconds_left ?? 0,
      teacher_name: body.teacher_name ?? null,
    });
    return 'takeover_pending';
  }
  if (body.expired) {
    clearCachedClassroomQrSession(args.schoolId, args.deviceId);
    return 'expired';
  }
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
