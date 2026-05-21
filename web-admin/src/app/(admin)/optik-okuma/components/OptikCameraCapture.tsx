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
import { captureVideoFrameJpeg } from '@/lib/optik-omr-decode';
import { Camera, Flashlight, FlashlightOff, ScanLine, X } from 'lucide-react';

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
}: {
  open: boolean;
  onClose: () => void;
  onCapture: (jpegBase64: string | string[]) => void | Promise<void>;
  busy?: boolean;
  /** Yoksa ayarlardan (MC) veya 1 */
  burstFrames?: number;
  cameraSettings?: OptikCameraSettings;
  mode?: 'mc' | 'key' | 'student';
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
  const streamRef = useRef<MediaStream | null>(null);

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
    <div className="fixed inset-0 z-[200] flex flex-col bg-black">
      <div className="flex items-center justify-between gap-2 bg-linear-to-r from-fuchsia-900/90 to-violet-900/90 px-3 py-2.5 text-white backdrop-blur-sm">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{title}</p>
          <p className="truncate text-[11px] text-white/75">{hint}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 shrink-0 rounded-full bg-white/10 text-white"
          onClick={onClose}
        >
          <X className="size-5" />
        </Button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
        {mode === 'mc' ? (
          <>
            <div className="pointer-events-none absolute inset-5 rounded-2xl border-2 border-fuchsia-400/70 shadow-[inset_0_0_40px_rgba(192,38,211,0.15)]" />
            <div className="pointer-events-none absolute left-5 top-5 size-5 rounded-sm border-2 border-white bg-black/80" />
            <div className="pointer-events-none absolute right-5 top-5 size-5 rounded-sm border-2 border-white bg-black/80" />
            <div className="pointer-events-none absolute bottom-5 left-5 size-5 rounded-sm border-2 border-white bg-black/80" />
            <div className="pointer-events-none absolute bottom-5 right-5 size-5 rounded-sm border-2 border-white bg-black/80" />
            <div className="pointer-events-none absolute bottom-24 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-[10px] text-white/90">
              A4 optik · omr-v3
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
