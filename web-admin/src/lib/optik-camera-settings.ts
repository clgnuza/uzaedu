import { smartBoardCameraErrorMessage } from '@/lib/smart-board-qr-scanner';

export type OptikCameraFacing = 'environment' | 'user';
export type OptikCameraResolution = 'high' | 'medium' | 'low';

export type OptikCameraSettings = {
  facingMode: OptikCameraFacing;
  resolution: OptikCameraResolution;
  mcBurstFrames: 1 | 2 | 3;
  jpegQuality: number;
  preferTorchOnStart: boolean;
};

const STORAGE_KEY = 'optik_camera_settings_v1';

export const DEFAULT_OPTIK_CAMERA_SETTINGS: OptikCameraSettings = {
  facingMode: 'environment',
  resolution: 'high',
  mcBurstFrames: 3,
  jpegQuality: 0.9,
  preferTorchOnStart: false,
};

export type CameraPermissionState = 'granted' | 'denied' | 'prompt' | 'unknown';

function resolutionConstraints(res: OptikCameraResolution): MediaTrackConstraints {
  if (res === 'high') {
    return { width: { ideal: 1920, min: 640 }, height: { ideal: 1080, min: 480 } };
  }
  if (res === 'medium') {
    return { width: { ideal: 1280 }, height: { ideal: 720 } };
  }
  return { width: { ideal: 640 }, height: { ideal: 480 } };
}

export function buildOptikVideoConstraints(settings: OptikCameraSettings): MediaStreamConstraints[] {
  const base = resolutionConstraints(settings.resolution);
  const facing = settings.facingMode;
  const focusExtra = { focusMode: { ideal: 'continuous' } } as Record<string, unknown>;
  return [
    {
      video: {
        facingMode: { ideal: facing },
        ...base,
        ...focusExtra,
      } as MediaTrackConstraints,
      audio: false,
    },
    {
      video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    },
    { video: { facingMode: facing }, audio: false },
    { video: true, audio: false },
  ];
}

export function loadOptikCameraSettings(): OptikCameraSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_OPTIK_CAMERA_SETTINGS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_OPTIK_CAMERA_SETTINGS };
    const p = JSON.parse(raw) as Partial<OptikCameraSettings>;
    const burst = p.mcBurstFrames;
    const mcBurstFrames =
      burst === 1 || burst === 2 || burst === 3 ? burst : DEFAULT_OPTIK_CAMERA_SETTINGS.mcBurstFrames;
    return {
      facingMode: p.facingMode === 'user' ? 'user' : 'environment',
      resolution:
        p.resolution === 'low' || p.resolution === 'medium' || p.resolution === 'high'
          ? p.resolution
          : DEFAULT_OPTIK_CAMERA_SETTINGS.resolution,
      mcBurstFrames,
      jpegQuality:
        typeof p.jpegQuality === 'number' && p.jpegQuality >= 0.7 && p.jpegQuality <= 0.98
          ? p.jpegQuality
          : DEFAULT_OPTIK_CAMERA_SETTINGS.jpegQuality,
      preferTorchOnStart: !!p.preferTorchOnStart,
    };
  } catch {
    return { ...DEFAULT_OPTIK_CAMERA_SETTINGS };
  }
}

export function saveOptikCameraSettings(patch: Partial<OptikCameraSettings>): OptikCameraSettings {
  const next = { ...loadOptikCameraSettings(), ...patch };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

export async function queryCameraPermission(): Promise<CameraPermissionState> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return 'unknown';
  }
  try {
    const perm = await navigator.permissions.query({ name: 'camera' as PermissionName });
    if (perm.state === 'granted') return 'granted';
    if (perm.state === 'denied') return 'denied';
    return 'prompt';
  } catch {
    return 'unknown';
  }
}

export async function openOptikCameraStream(
  settings: OptikCameraSettings = loadOptikCameraSettings(),
): Promise<MediaStream> {
  let lastErr: unknown;
  for (const c of buildOptikVideoConstraints(settings)) {
    try {
      return await navigator.mediaDevices.getUserMedia(c);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error('Kamera açılamadı');
}

export { smartBoardCameraErrorMessage };

export type OptikCameraHelpPlatform = 'ios' | 'android' | 'desktop' | 'unknown';

export function detectOptikCameraHelpPlatform(): OptikCameraHelpPlatform {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

export function optikCameraPermissionHelp(platform: OptikCameraHelpPlatform): string[] {
  const host =
    typeof window !== 'undefined' ? window.location.hostname : 'bu site';
  if (platform === 'ios') {
    return [
      'Ayarlar → Safari → Kamera → «Sor» veya «İzin ver».',
      `Safari’de ${host} için kamera iznini açın.`,
      'Ana ekran kısayolu (PWA) kullanıyorsanız: Ayarlar → uygulama → Kamera.',
      'Sayfayı yenileyip «Kamera testi»ne tekrar dokunun.',
    ];
  }
  if (platform === 'android') {
    return [
      'Adres çubuğundaki kilit/kamera simgesine dokunun → Kamera → İzin ver.',
      'Chrome: ⋮ → Site ayarları → Kamera.',
      'Başka uygulama kamerayı kullanıyorsa kapatın.',
    ];
  }
  return [
    `Adres çubuğu: site bilgisi → Kamera → ${host} için «İzin ver».`,
    'Chrome: chrome://settings/content/camera',
    'Firefox: Sayfa bilgisi → İzinler → Kullan kamera.',
    'Yalnızca HTTPS veya localhost’ta çalışır.',
  ];
}

export function isSecureCameraContext(): boolean {
  if (typeof window === 'undefined') return true;
  return window.isSecureContext;
}
