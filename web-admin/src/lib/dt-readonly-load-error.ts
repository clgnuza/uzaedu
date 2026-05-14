import type { ApiError } from './api';

export type DtReadonlyLoadBanner = { message: string; variant: 'warning' | 'error' };

const SERVER_WARN =
  'Veriler şu an görüntülenemiyor. Sunucu geçici olarak yanıt vermedi; lütfen bir süre sonra sayfayı yenileyin.';

/** DT modülü: 5xx veya “Bir hata oluştu” içeren yanıtta uyarı; diğer durumlarda hata (Alert variant). */
export function dtReadonlyLoadFeedback(e: unknown): DtReadonlyLoadBanner {
  const err = e as ApiError;
  const status = typeof err?.status === 'number' ? err.status : 0;
  const msg = e instanceof Error ? e.message : String(e);
  if (status >= 500 || msg.includes('Bir hata oluştu')) {
    return { variant: 'warning', message: SERVER_WARN };
  }
  return { variant: 'error', message: msg.trim() || 'Yüklenemedi' };
}
