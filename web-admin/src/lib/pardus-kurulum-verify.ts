import { getApiUrl } from '@/lib/api';

export function classroomSetupErrorMessage(code?: string, fallback?: string): string {
  switch (code) {
    case 'INVALID_SETUP_CODE':
    case 'SETUP_CODE_NOT_FOUND':
      return 'Kurulum kodu geçersiz. Okul yöneticisinden güncel link isteyin.';
    case 'TV_ACCESS_RESTRICTED':
      return 'İstek okul ağı dışından. Bu bilgisayar veya tahta okul internetinde olmalı.';
    case 'PAIRING_CODE_INVALID':
      return 'Eşleştirme kodu hatalı. Tahta etiketindeki kodu girin.';
    case 'SETUP_DEVICE_SCOPE':
      return 'Bu tahta bu okul kurulum koduna ait değil.';
    case 'TV_RATE_LIMIT':
      return 'Çok fazla deneme. Biraz bekleyin.';
    case 'TV_IP_NOT_CONFIGURED':
      return 'TV izinli IP listesi tanımlı değil; boş bırakılabilir (güncel sunucu).';
    default:
      return fallback || 'İşlem tamamlanamadı.';
  }
}

/** Kurulum sonrası: sınıf TV adresinin sunucuya erişimi (kilit modu duyuru). */
export async function verifyClassroomTvReachable(
  schoolId: string,
  deviceId: string,
): Promise<{ ok: boolean; message: string; schoolName?: string }> {
  try {
    const q = new URLSearchParams({
      school_id: schoolId,
      device_id: deviceId,
      kilit: '1',
      nocache: '1',
    });
    const res = await fetch(getApiUrl(`/tv/announcements/classroom?${q}`));
    const body = (await res.json().catch(() => ({}))) as {
      school?: { name?: string };
      message?: string;
      code?: string;
    };
    if (!res.ok) {
      return { ok: false, message: classroomSetupErrorMessage(body.code, body.message) };
    }
    if (!body.school?.name?.trim()) {
      return { ok: false, message: 'Sunucu yanıt verdi ancak okul bilgisi alınamadı.' };
    }
    return {
      ok: true,
      message: `Bağlantı tamam: ${body.school.name.trim()}`,
      schoolName: body.school.name.trim(),
    };
  } catch {
    return {
      ok: false,
      message: 'Ağ hatası. Tahta okul internetinde mi? Panelde TV izinli IP listesini kontrol edin.',
    };
  }
}
