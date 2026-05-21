import jsQR from 'jsqr';

export function smartBoardCameraErrorMessage(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      return 'Kamera izni reddedildi. Ayarlardan bu site için kameraya izin verin.';
    }
    if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      return 'Kamera bulunamadı.';
    }
    if (err.name === 'NotReadableError') {
      return 'Kamera başka uygulama tarafından kullanılıyor olabilir.';
    }
    if (err.name === 'SecurityError' || err.name === 'NotSupportedError') {
      return 'Kamera yalnızca güvenli bağlantıda (HTTPS) kullanılabilir.';
    }
    return err.message || 'Kamera açılamadı';
  }
  return err instanceof Error ? err.message : 'Kamera açılamadı';
}

const VIDEO_CONSTRAINTS: MediaStreamConstraints[] = [
  {
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1920, min: 640 },
      height: { ideal: 1080, min: 480 },
      ...({ focusMode: { ideal: 'continuous' } } as Record<string, unknown>),
    } as MediaTrackConstraints,
    audio: false,
  },
  {
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
    audio: false,
  },
  { video: { facingMode: 'environment' }, audio: false },
  { video: true, audio: false },
];

export async function openSmartBoardCameraStream(): Promise<MediaStream> {
  let lastErr: unknown;
  for (const c of VIDEO_CONSTRAINTS) {
    try {
      return await navigator.mediaDevices.getUserMedia(c);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error('Kamera açılamadı');
}

type BarcodeDetectorLike = {
  detect: (src: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
};

let sharedCanvas: HTMLCanvasElement | null = null;
let sharedCtx: CanvasRenderingContext2D | null = null;

function getCanvas(w: number, h: number): CanvasRenderingContext2D | null {
  if (!sharedCanvas) {
    sharedCanvas = document.createElement('canvas');
    sharedCtx = sharedCanvas.getContext('2d', { willReadFrequently: true });
  }
  if (!sharedCtx) return null;
  sharedCanvas.width = w;
  sharedCanvas.height = h;
  return sharedCtx;
}

function decodeFromImageData(data: ImageData, w: number, h: number): string | null {
  const normal = jsQR(data.data, w, h);
  if (normal?.data) return normal.data;
  const inv = jsQR(data.data, w, h, { inversionAttempts: 'attemptBoth' });
  return inv?.data ?? null;
}

/** Tam kare + merkez kırpım (uzaktaki QR için daha hassas). */
export function decodeQrFromVideoFrame(video: HTMLVideoElement): string | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;

  const ctx = getCanvas(vw, vh);
  if (!ctx || !sharedCanvas) return null;

  ctx.drawImage(video, 0, 0, vw, vh);
  const full = ctx.getImageData(0, 0, vw, vh);
  const fromFull = decodeFromImageData(full, vw, vh);
  if (fromFull) return fromFull;

  const crop = 0.72;
  const cw = Math.floor(vw * crop);
  const ch = Math.floor(vh * crop);
  const ox = Math.floor((vw - cw) / 2);
  const oy = Math.floor((vh - ch) / 2);
  const cropCtx = getCanvas(cw, ch);
  if (!cropCtx || !sharedCanvas) return null;
  cropCtx.drawImage(video, ox, oy, cw, ch, 0, 0, cw, ch);
  const cropped = cropCtx.getImageData(0, 0, cw, ch);
  return decodeFromImageData(cropped, cw, ch);
}

export type SmartBoardQrScannerHandle = { stop: () => void };

/**
 * BarcodeDetector (Chrome/Safari) + jsQR yedek; jsQR ~12 fps ile çalışır.
 * onDecoded true dönerse döngü durur.
 */
export function startSmartBoardQrScanner(args: {
  video: HTMLVideoElement;
  onDecoded: (raw: string) => void | boolean | Promise<void | boolean>;
}): SmartBoardQrScannerHandle {
  let stopped = false;
  let raf = 0;
  let lastJs = 0;
  const JSQR_MS = 72;
  let busy = false;

  let detector: BarcodeDetectorLike | null = null;
  if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
    try {
      detector = new (
        window as unknown as { BarcodeDetector: new (o: { formats: string[] }) => BarcodeDetectorLike }
      ).BarcodeDetector({ formats: ['qr_code'] });
    } catch {
      detector = null;
    }
  }

  const tick = (now: number) => {
    if (stopped) return;
    raf = requestAnimationFrame(tick);

    void (async () => {
      if (busy || stopped) return;
      busy = true;
      try {
        if (detector) {
          const codes = await detector.detect(args.video);
          const raw = codes[0]?.rawValue?.trim();
          if (raw) {
            const halt = await args.onDecoded(raw);
            if (halt) {
              stopped = true;
              cancelAnimationFrame(raf);
            }
            return;
          }
        }
        if (now - lastJs >= JSQR_MS) {
          lastJs = now;
          const raw = decodeQrFromVideoFrame(args.video)?.trim();
          if (raw) {
            const halt = await args.onDecoded(raw);
            if (halt) {
              stopped = true;
              cancelAnimationFrame(raf);
            }
          }
        }
      } catch {
        /* kare atla */
      } finally {
        busy = false;
      }
    })();
  };

  raf = requestAnimationFrame(tick);
  return {
    stop: () => {
      stopped = true;
      cancelAnimationFrame(raf);
    },
  };
}

export async function toggleCameraTorch(stream: MediaStream, on: boolean): Promise<boolean> {
  const track = stream.getVideoTracks()[0];
  if (!track?.getCapabilities) return false;
  const caps = track.getCapabilities() as MediaTrackCapabilities & { torch?: boolean };
  if (!caps.torch) return false;
  try {
    await track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
    return true;
  } catch {
    return false;
  }
}
