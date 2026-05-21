'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { cn } from '@/lib/utils';
import {
  loadOptikCameraSettings,
  openOptikCameraStream,
  smartBoardCameraErrorMessage,
  type OptikCameraSettings,
} from '@/lib/optik-camera-settings';
import { optikToast } from '@/lib/optik-toast';
import { toggleCameraTorch } from '@/lib/smart-board-qr-scanner';
import {
  captureVideoFrameJpeg,
  decodeOmrLivePreviewFromVideo,
  preloadOptikOpenCv,
  type OmrDecodeMode,
  type OmrLivePreview,
} from '@/lib/optik-omr-decode';
import type { OmrScanLayout } from '@/lib/optik-api';
import {
  OptikOmrCameraOverlay,
  OptikOmrOverlayLegend,
  buildOverlayStats,
} from './OptikOmrCameraOverlay';
import { answerKeyToNumberMap } from '@/lib/optik-omr-overlay';
import { Camera, Flashlight, FlashlightOff, ScanLine, X } from 'lucide-react';

export type OptikCameraOverlayConfig = {
  layout: OmrScanLayout;
  maxQuestion: number;
  mode?: OmrDecodeMode;
  /** Doluysa yeşil/kırmızı karşılaştırma */
  answerKey?: Record<string, string> | Record<number, string>;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function OptikCameraCapture({
  open,
  onClose,
  onCapture,
  busy,
  burstFrames,
  cameraSettings,
  mode = 'mc',
  omrOverlay = null,
}: {
  open: boolean;
  onClose: () => void;
  onCapture: (jpegBase64: string | string[]) => void | Promise<void>;
  busy?: boolean;
  /** Yoksa ayarlardan (MC) veya 1 */
  burstFrames?: number;
  cameraSettings?: OptikCameraSettings;
  mode?: 'mc' | 'key' | 'student';
  omrOverlay?: OptikCameraOverlayConfig | null;
}) {
  const settings = cameraSettings ?? loadOptikCameraSettings();
  const frameCount =
    burstFrames ??
    (mode === 'mc' ? settings.mcBurstFrames : 1);
  const jpegQ = settings.jpegQuality;
  const [mounted, setMounted] = useState(false);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvail, setTorchAvail] = useState(false);
  const [progress, setProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoWrapRef = useRef<HTMLDivElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const liveBusyRef = useRef(false);
  const [livePreview, setLivePreview] = useState<OmrLivePreview | null>(null);

  const title =
    mode === 'mc' ? 'Optik form' : mode === 'key' ? 'Anahtar metni' : 'Öğrenci cevabı';
  const hint =
    mode === 'mc'
      ? 'Köşe kareleri çerçevede · formu sabit tutun'
      : 'Yazı net ve tam kadrajda olsun';

  const stopAll = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setReady(false);
    setTorchOn(false);
    setTorchAvail(false);
    setProgress(0);
    setLivePreview(null);
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      stopAll();
      setErr(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const stream = await openOptikCameraStream(settings);
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setReady(true);
        setErr(null);
        const track = stream.getVideoTracks()[0];
        const caps = track?.getCapabilities?.() as { torch?: boolean } | undefined;
        const hasTorch = !!caps?.torch;
        setTorchAvail(hasTorch);
        if (hasTorch && settings.preferTorchOnStart) {
          const ok = await toggleCameraTorch(stream, true);
          if (ok) setTorchOn(true);
        }
      } catch (e) {
        if (!cancelled) {
          setErr(smartBoardCameraErrorMessage(e));
          optikToast.cameraError(e);
        }
      }
    })();
    return () => {
      cancelled = true;
      stopAll();
    };
  }, [open, stopAll, settings]);

  useEffect(() => {
    if (open && mode === 'mc') void preloadOptikOpenCv();
  }, [open, mode]);

  const overlayKey = omrOverlay?.answerKey
    ? answerKeyToNumberMap(omrOverlay.answerKey)
    : undefined;
  const showGrade = !!overlayKey && Object.keys(overlayKey).length > 0;
  const overlayStats = buildOverlayStats(
    livePreview,
    overlayKey,
    omrOverlay?.maxQuestion ?? 0,
  );

  useEffect(() => {
    if (!open || !ready || mode !== 'mc' || !omrOverlay?.layout) {
      setLivePreview(null);
      return;
    }
    let raf = 0;
    let last = 0;
    const tick = (t: number) => {
      if (t - last >= 520 && !liveBusyRef.current) {
        last = t;
        const video = videoRef.current;
        if (video?.videoWidth) {
          liveBusyRef.current = true;
          void decodeOmrLivePreviewFromVideo(video, omrOverlay.layout, {
            maxQuestion: omrOverlay.maxQuestion,
            mode: omrOverlay.mode ?? 'student',
          })
            .then((p) => {
              if (p) setLivePreview(p);
            })
            .catch(() => {
              /* kamera / OpenCV hazır değil */
            })
            .finally(() => {
              liveBusyRef.current = false;
            });
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [open, ready, mode, omrOverlay]);

  const handleClose = useCallback(() => {
    stopAll();
    onClose();
  }, [stopAll, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, handleClose]);

  const handleShot = async () => {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    const n = Math.min(3, Math.max(1, frameCount));
    if (n === 1) {
      await onCapture(captureVideoFrameJpeg(video, jpegQ));
      return;
    }
    const frames: string[] = [];
    for (let i = 0; i < n; i++) {
      setProgress(i + 1);
      frames.push(captureVideoFrameJpeg(video, jpegQ));
      if (i < n - 1) await sleep(70);
    }
    setProgress(0);
    await onCapture(frames);
  };

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[250] flex min-h-0 flex-col bg-black">
      <div className="relative z-50 flex shrink-0 items-center justify-between gap-2 bg-linear-to-r from-fuchsia-900/90 to-violet-900/90 px-3 pb-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] text-white backdrop-blur-sm">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{title}</p>
          <p className="truncate text-[11px] text-white/75">{hint}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Kamerayı kapat"
          className="size-11 shrink-0 touch-manipulation rounded-full bg-white/15 text-white hover:bg-white/25"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleClose();
          }}
        >
          <X className="size-6" />
        </Button>
      </div>

      <div ref={videoWrapRef} className="relative min-h-0 flex-1 overflow-hidden">
        <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
        {mode === 'mc' && omrOverlay?.layout && livePreview ? (
          <OptikOmrCameraOverlay
            videoRef={videoRef}
            containerRef={videoWrapRef}
            preview={livePreview}
            answerKey={overlayKey}
            maxQuestion={omrOverlay.maxQuestion}
            showGrade={showGrade}
          />
        ) : null}
        {mode === 'mc' && omrOverlay?.layout ? (
          <OptikOmrOverlayLegend showGrade={showGrade} stats={overlayStats} />
        ) : null}
        {mode === 'mc' ? (
          <>
            <div className="pointer-events-none absolute inset-5 rounded-2xl border-2 border-fuchsia-400/70 shadow-[inset_0_0_40px_rgba(192,38,211,0.15)]" />
            <div className="pointer-events-none absolute left-5 top-5 size-5 rounded-sm border-2 border-white bg-black/80" />
            <div className="pointer-events-none absolute right-5 top-5 size-5 rounded-sm border-2 border-white bg-black/80" />
            <div className="pointer-events-none absolute bottom-5 left-5 size-5 rounded-sm border-2 border-white bg-black/80" />
            <div className="pointer-events-none absolute bottom-5 right-5 size-5 rounded-sm border-2 border-white bg-black/80" />
            <div className="pointer-events-none absolute bottom-24 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1">
              <span className="rounded-full bg-black/50 px-3 py-1 text-[10px] text-white/90">
                A4 optik · omr-v4
              </span>
              {livePreview?.result.warp_engine ? (
                <span className="rounded-full bg-black/55 px-2 py-0.5 text-[9px] text-emerald-200">
                  {livePreview.result.warp_engine === 'opencv'
                    ? 'OpenCV hizalı'
                    : livePreview.result.warp_engine === 'legacy'
                      ? 'Yerel hizalı'
                      : 'Hiza zayıf'}
                  {livePreview.anchorScore > 0
                    ? ` · %${Math.round(livePreview.anchorScore * 100)}`
                    : ''}
                </span>
              ) : null}
            </div>
          </>
        ) : (
          <div className="pointer-events-none absolute inset-8 rounded-xl border-2 border-dashed border-cyan-400/60" />
        )}
      </div>

      {err ? (
        <p className="truncate px-4 py-2 text-center text-xs text-red-300" title={err}>
          {err}
        </p>
      ) : null}

      {progress > 0 ? (
        <p className="text-center text-xs text-fuchsia-300">Kare {progress}/{frameCount}</p>
      ) : null}

      <div className="flex items-center justify-center gap-3 border-t border-white/10 bg-black/80 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {torchAvail ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-12 rounded-full border-white/30 text-white"
            onClick={async () => {
              const stream = streamRef.current;
              if (!stream) return;
              const next = !torchOn;
              const ok = await toggleCameraTorch(stream, next);
              if (ok) setTorchOn(next);
            }}
          >
            {torchOn ? <FlashlightOff className="size-5" /> : <Flashlight className="size-5" />}
          </Button>
        ) : null}
        <Button
          type="button"
          size="lg"
          disabled={!ready || busy}
          onClick={() => void handleShot()}
          className={cn(
            'h-14 min-w-[200px] gap-2 rounded-2xl text-base font-bold shadow-xl',
            mode === 'mc'
              ? 'bg-linear-to-r from-fuchsia-500 to-violet-600 shadow-fuchsia-500/40'
              : 'bg-linear-to-r from-cyan-500 to-sky-600 shadow-cyan-500/40',
          )}
        >
          {busy ? (
            <LoadingSpinner className="size-5 text-white" />
          ) : mode === 'mc' ? (
            <ScanLine className="size-5" />
          ) : (
            <Camera className="size-5" />
          )}
          {frameCount > 1 ? 'Tara' : 'Çek'}
        </Button>
      </div>
    </div>,
    document.body,
  );
}
