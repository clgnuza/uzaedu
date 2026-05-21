export type SmartBoardAuditLogLike = {
  action: string;
  user: { display_name: string | null; email: string } | null;
  meta: Record<string, unknown> | null;
};

const ACTION_LABELS: Record<string, string> = {
  SMARTBOARD_BULK_OPEN: 'Toplu: duyuru moduna al',
  SMARTBOARD_BULK_LOCK: 'Toplu: oturumları sonlandır (kilit)',
  SMARTBOARD_BULK_CLOSE: 'Toplu: tahtayı kapat',
  SMARTBOARD_DEVICE_CREATED: 'Tahta kaydı eklendi',
  SMARTBOARD_DEVICE_UPDATED: 'Tahta bilgisi güncellendi',
  SMARTBOARD_DEVICE_REMOVED: 'Tahta kaydı silindi',
  SMARTBOARD_QR_SESSION_CREATED: 'Tahtada öğretmen giriş QR’ı oluşturuldu',
  SMARTBOARD_QR_SESSION_CLAIMED: 'Öğretmen QR onayı verdi',
  SMARTBOARD_USB_PIN_UNLOCK_SUCCESS: 'Tahta PIN ile açıldı',
  SMARTBOARD_OTP_UNLOCK_SUCCESS: 'Tahta tek kullanımlık kod ile açıldı',
  SMARTBOARD_OTP_CODES_REGENERATED: 'Öğretmen yedek kodları yenilendi',
  SMARTBOARD_SETUP_CODE_REGENERATED: 'Tahta kurulum kodu yenilendi',
  SMARTBOARD_USB_PIN_SET: 'Öğretmene tahta PIN’i tanımlandı',
  SMARTBOARD_USB_PIN_CLEARED: 'Öğretmen tahta PIN’i kaldırıldı',
  SMARTBOARD_TEACHER_AUTHORIZED: 'Öğretmene tahta yetkisi verildi',
  SMARTBOARD_TEACHER_UNAUTHORIZED: 'Öğretmen tahta yetkisi kaldırıldı',
  SMARTBOARD_DISCONNECT_ALL_ACTIVE: 'Tüm aktif tahta oturumları sonlandırıldı',
};

const UNLOCK_METHOD_LABELS: Record<string, string> = {
  pin: 'PIN',
  otp: 'Tek kullanımlık kod',
  auto: 'Otomatik (PIN veya kod)',
};

function shortId(v: string): string {
  return v.length > 8 ? `${v.slice(0, 8)}…` : v;
}

function teacherLabel(
  userId: string | null,
  teacherNameById: Map<string, string>,
): string | null {
  if (!userId) return null;
  return teacherNameById.get(userId) ?? `Öğretmen ${shortId(userId)}`;
}

export function getSmartBoardAuditActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/^SMARTBOARD_/, '').replace(/_/g, ' ').toLowerCase();
}

export function getSmartBoardAuditMetaText(
  log: SmartBoardAuditLogLike,
  deviceNameById: Map<string, string>,
  teacherNameById: Map<string, string> = new Map(),
): string {
  const meta = log.meta ?? {};
  const get = (k: string): string | null => {
    const v = meta[k];
    return typeof v === 'string' && v.trim() ? v.trim() : null;
  };
  const getNum = (k: string): number | null => {
    const v = meta[k];
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  };

  const deviceId = get('deviceId') ?? get('device_id');
  const deviceNameFromMeta = get('deviceName') ?? get('device_name');
  const classFromMeta = get('classSection') ?? get('class_section');
  const unlockRaw = get('unlockMethod') ?? get('unlock_method');
  const unlockMethod = unlockRaw ? (UNLOCK_METHOD_LABELS[unlockRaw.toLowerCase()] ?? unlockRaw) : null;

  const targetUserId = get('targetUserId') ?? get('addedUserId') ?? get('removedUserId');
  const teacher = teacherLabel(targetUserId, teacherNameById);

  const deviceLabel =
    (deviceNameFromMeta
      ? `${deviceNameFromMeta}${classFromMeta ? ` (${classFromMeta})` : ''}`
      : null) ??
    (deviceId ? (deviceNameById.get(deviceId) ?? `Tahta ${shortId(deviceId)}`) : null);

  if (log.action === 'SMARTBOARD_DEVICE_REMOVED') {
    return deviceLabel ? `${deviceLabel} listeden kaldırıldı.` : 'Tahta kaydı silindi.';
  }
  if (log.action === 'SMARTBOARD_DEVICE_CREATED') {
    return deviceLabel ? `${deviceLabel} sisteme eklendi.` : 'Yeni tahta kaydı oluşturuldu.';
  }
  if (log.action === 'SMARTBOARD_QR_SESSION_CREATED') {
    return deviceLabel
      ? `${deviceLabel} için öğretmen giriş QR’ı gösterildi.`
      : 'Tahta ekranında öğretmen giriş QR’ı oluşturuldu.';
  }
  if (log.action === 'SMARTBOARD_QR_SESSION_CLAIMED') {
    const who = log.user?.display_name || log.user?.email;
    return deviceLabel
      ? `${who ? `${who}, ` : ''}${deviceLabel} için QR onayı verdi.`
      : 'Öğretmen telefondan QR onayı verdi.';
  }
  if (log.action === 'SMARTBOARD_USB_PIN_UNLOCK_SUCCESS' || log.action === 'SMARTBOARD_OTP_UNLOCK_SUCCESS') {
    return [
      deviceLabel ? `${deviceLabel} duyuru modundan çıkarıldı` : 'Tahta kullanım modu açıldı',
      unlockMethod ? `(${unlockMethod})` : null,
    ]
      .filter(Boolean)
      .join(' ');
  }
  if (log.action === 'SMARTBOARD_OTP_CODES_REGENERATED') {
    const n = getNum('count');
    return teacher
      ? `${teacher} için ${n ?? 'yeni'} adet yedek kod üretildi.`
      : 'Öğretmen yedek giriş kodları yenilendi.';
  }
  if (log.action === 'SMARTBOARD_USB_PIN_SET') {
    return teacher ? `${teacher} için tahta PIN’i kaydedildi.` : 'Öğretmen tahta PIN’i tanımlandı.';
  }
  if (log.action === 'SMARTBOARD_USB_PIN_CLEARED') {
    return teacher ? `${teacher} tahta PIN’i silindi.` : 'Öğretmen tahta PIN’i kaldırıldı.';
  }
  if (log.action === 'SMARTBOARD_TEACHER_AUTHORIZED') {
    return teacher ? `${teacher} akıllı tahta kullanabilir.` : 'Öğretmene tahta kullanım yetkisi verildi.';
  }
  if (log.action === 'SMARTBOARD_TEACHER_UNAUTHORIZED') {
    return teacher ? `${teacher} tahta yetkisi kaldırıldı.` : 'Öğretmenin tahta yetkisi kaldırıldı.';
  }
  if (log.action === 'SMARTBOARD_DISCONNECT_ALL_ACTIVE') {
    const n = getNum('count');
    return n != null ? `${n} aktif oturum sonlandırıldı.` : 'Tüm aktif tahta oturumları kapatıldı.';
  }
  if (log.action === 'SMARTBOARD_SETUP_CODE_REGENERATED') {
    return 'Okul tahta kurulum kodu yenilendi.';
  }
  if (
    log.action === 'SMARTBOARD_BULK_OPEN' ||
    log.action === 'SMARTBOARD_BULK_LOCK' ||
    log.action === 'SMARTBOARD_BULK_CLOSE'
  ) {
    const updated = getNum('updated');
    const requested = getNum('requestedCount');
    const verb =
      log.action === 'SMARTBOARD_BULK_OPEN'
        ? 'duyuru moduna alındı'
        : log.action === 'SMARTBOARD_BULK_CLOSE'
          ? 'kapatıldı'
          : 'kilitlendi (bağlı oturumlar sonlandırıldı)';
    if (updated != null && requested != null) {
      return `${updated} tahta ${verb}${requested > updated ? ` (${requested - updated} atlandı)` : ''}.`;
    }
    if (updated != null) return `${updated} tahta ${verb}.`;
    return `Seçili tahtalar ${verb}.`;
  }

  const lines: string[] = [];
  if (deviceLabel) lines.push(`Tahta: ${deviceLabel}`);
  if (teacher) lines.push(`Öğretmen: ${teacher}`);
  if (unlockMethod) lines.push(`Yöntem: ${unlockMethod}`);

  return lines.length > 0 ? lines.join(' · ') : '—';
}
