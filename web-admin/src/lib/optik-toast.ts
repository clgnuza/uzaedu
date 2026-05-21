import { toast } from 'sonner';
import type { ApiError } from '@/lib/api';
import { smartBoardCameraErrorMessage } from '@/lib/smart-board-qr-scanner';

export type OptikToastKind =
  | 'load'
  | 'scan'
  | 'ocr'
  | 'grade'
  | 'key'
  | 'session'
  | 'export'
  | 'pdf'
  | 'camera'
  | 'sync'
  | 'save';

const KIND_TITLE: Record<OptikToastKind, string> = {
  load: 'Yüklenemedi',
  scan: 'Tarama başarısız',
  ocr: 'Metin okunamadı',
  grade: 'Puanlama başarısız',
  key: 'Anahtar kaydedilemedi',
  session: 'Oturum işlemi başarısız',
  export: 'Dışa aktarma başarısız',
  pdf: 'PDF indirilemedi',
  camera: 'Kamera açılamadı',
  sync: 'Senkron başarısız',
  save: 'Kayıt başarısız',
};

const TOAST_ERR = { duration: 5000 } as const;
const TOAST_WARN = { duration: 4500 } as const;
const TOAST_OK = { duration: 2800 } as const;

export function getOptikErrorMessage(e: unknown, fallback = 'Beklenmeyen hata'): string {
  if (e instanceof DOMException) return smartBoardCameraErrorMessage(e);
  if (e && typeof e === 'object' && 'name' in e) {
    const name = String((e as { name: string }).name);
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      return 'Kamera izni reddedildi. Site ayarlarından izin verin.';
    }
  }
  if (e instanceof Error) {
    const api = e as ApiError;
    if (api.status === 429) {
      return 'Günlük optik kullanım limitine ulaşıldı. Yarın tekrar deneyin veya yöneticinize bildirin.';
    }
    if (api.status === 401) return 'Oturum süresi doldu. Çıkış yapıp yeniden giriş yapın.';
    if (api.status === 403) return e.message || 'Bu işlem için yetkiniz yok.';
    if (api.status === 503) return 'Optik servisi geçici olarak kullanılamıyor.';
    if (api.status === 502 || api.status === 504) return 'Sunucuya ulaşılamadı. Bağlantınızı kontrol edin.';
    if (e.message?.trim()) return e.message;
  }
  if (typeof e === 'string' && e.trim()) return e;
  return fallback;
}

function isCameraPermissionError(e: unknown): boolean {
  if (e instanceof DOMException) {
    return e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError';
  }
  const msg = getOptikErrorMessage(e, '').toLowerCase();
  return msg.includes('izin') && msg.includes('kamera');
}

export const optikToast = {
  error(e: unknown, kind: OptikToastKind = 'save', title?: string) {
    toast.error(title ?? KIND_TITLE[kind], {
      ...TOAST_ERR,
      description: getOptikErrorMessage(e),
    });
  },

  errorMsg(title: string, description?: string) {
    toast.error(title, { ...TOAST_ERR, description });
  },

  warn(title: string, description?: string) {
    toast.warning(title, { ...TOAST_WARN, description });
  },

  success(title: string, description?: string) {
    toast.success(title, { ...TOAST_OK, description });
  },

  info(title: string, description?: string) {
    toast.info(title, { duration: 3500, description });
  },

  cameraError(e: unknown) {
    const description = getOptikErrorMessage(e);
    toast.error(KIND_TITLE.camera, {
      ...TOAST_ERR,
      description,
      action: isCameraPermissionError(e)
        ? {
            label: 'İzin',
            onClick: () => {
              optikToast.info('Kamera izni', 'Adres çubuğu → site → Kamera → İzin ver');
            },
          }
        : undefined,
    });
  },

  rescan(kind: 'mc' | 'ocr' | 'grade', detail?: string) {
    const titles = {
      mc: 'Belirsiz şıklar',
      ocr: 'Metin net değil',
      grade: 'Puanlama belirsiz',
    };
    optikToast.warn(titles[kind], detail ?? 'Sonucu kontrol edip gerekirse yeniden tarayın.');
  },

  offlineQueued() {
    optikToast.warn('Çevrimdışı', 'Tarama kuyruğa alındı. Bağlantı gelince senkron edin.');
  },

  validation(msg: string) {
    toast.error('Eksik bilgi', { ...TOAST_ERR, description: msg });
  },
};
