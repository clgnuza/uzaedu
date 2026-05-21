'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  openSmartBoardCameraStream,
  smartBoardCameraErrorMessage,
  startSmartBoardQrScanner,
  toggleCameraTorch,
} from '@/lib/smart-board-qr-scanner';
import { parseSmartBoardQrClaimUrl } from '@/lib/smart-board-qr-parse';
import { ClipboardPaste, Flashlight, FlashlightOff, X } from 'lucide-react';

export function TeacherQrScannerOverlay({
  open,
  onClose,
  onDecoded,
  busy,
  deviceHint,
}: {
  open: boolean;
  onClose: () => void;
  onDecoded: (raw: string) => Promise<boolean>;
  busy?: boolean;
  deviceHint?: string | null;
}) {
  const [mounted, setMounted] = useState(false);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [paste, setPaste] = useState('');
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvail, setTorchAvail] = useState(false);
  const [locked, setLocked] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scannerRef = useRef<{ stop: () => void } | null>(null);
  const claimingRef = useRef(false);
  const onDecodedRef = useRef(onDecoded);
  const busyRef = useRef(busy);
  const openRef = useRef(open);

  useEffect(() => {
    onDecodedRef.current = onDecoded;
    busyRef.current = busy;
    openRef.current = open;
  }, [onDecoded, busy, open]);

  const stopAll = useCallback(() => {
    scannerRef.current?.stop();
    scannerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setReady(false);
    setTorchOn(false);
    setTorchAvail(false);
  }, []);

  const handleDecode = useCallback(async (raw: string) => {
    if (claimingRef.current || busyRef.current) return false;
    const p = parseSmartBoardQrClaimUrl(raw);
    if (!p) return false;
    claimingRef.current = true;
    setLocked(true);
    scannerRef.current?.stop();
    try {
      const ok = await onDecodedRef.current(raw);
      if (ok) {
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(40);
        stopAll();
        onClose();
        return true;
      }
      setLocked(false);
      claimingRef.current = false;
      setErr('QR onayı tamamlanamadı. Tekrar deneyin.');
      if (openRef.current && videoRef.current && streamRef.current) {
        scannerRef.current = startSmartBoardQrScanner({
          video: videoRef.current,
          onDecoded: handleDecode,
        });
      }
      return false;
    } catch {
      setLocked(false);
      claimingRef.current = false;
      setErr('Bağlantı hatası. Tekrar okutun.');
      if (openRef.current && videoRef.current && streamRef.current) {
        scannerRef.current = startSmartBoardQrScanner({
          video: videoRef.current,
          onDecoded: handleDecode,
        });
      }
      return false;
    }
  }, [onClose, stopAll]);

  const attachStream = useCallback(async () => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream || !openRef.current) return;
    video.setAttribute('playsinline', 'true');
    video.setAttribute('webkit-playsinline', 'true');
    video.muted = true;
    video.srcObject = stream;
    await video.play();
    setReady(true);
    scannerRef.current?.stop();
    scannerRef.current = startSmartBoardQrScanner({
      video,
      onDecoded: handleDecode,
    });
  }, [handleDecode]);

  const startCamera = useCallback(async () => {
    setErr(null);
    setLocked(false);
    claimingRef.current = false;
    if (!window.isSecureContext) {
      setErr('Kamera için HTTPS veya localhost gerekir.');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setErr('Bu cihazda kamera desteklenmiyor.');
      return;
    }
    stopAll();
    try {
      const stream = await openSmartBoardCameraStream();
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      const caps = track?.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined;
      setTorchAvail(!!caps?.torch);
      await attachStream();
    } catch (e) {
      stopAll();
      setErr(smartBoardCameraErrorMessage(e));
    }
  }, [attachStream, stopAll]);

  const bindVideoRef = useCallback(
    (node: HTMLVideoElement | null) => {
      videoRef.current = node;
      if (node && streamRef.current && openRef.current) {
        void attachStream().catch(() => setErr('Kamera önizlemesi başlatılamadı.'));
      }
    },
    [attachStream],
  );

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) {
      stopAll();
      setPasteOpen(false);
      setPaste('');
      setErr(null);
      setLocked(false);
      claimingRef.current = false;
      return;
    }
    document.body.style.overflow = 'hidden';
    void startCamera();
    return () => {
      document.body.style.overflow = '';
      stopAll();
    };
    // Yalnızca open: busy/onDecoded değişince kamerayı yeniden başlatma (onay sırasında kesilmesin)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggleTorch = async () => {
    const stream = streamRef.current;
    if (!stream) return;
    const next = !torchOn;
    const ok = await toggleCameraTorch(stream, next);
    if (ok) setTorchOn(next);
  };

  const submitPaste = async () => {
    const ok = await handleDecode(paste);
    if (!ok && !parseSmartBoardQrClaimUrl(paste)) {
      setErr('Geçerli tahta QR linki değil.');
    }
  };

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-200 flex flex-col bg-black text-white"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Tahta QR okut"
    >
      <video
        ref={bindVideoRef}
        className="absolute inset-0 size-full object-cover"
        muted
        playsInline
        autoPlay
        aria-hidden
      />

      <div className="pointer-events-none absolute inset-0 bg-black/45" aria-hidden />
      <div
        className="pointer-events-none absolute left-1/2 top-[42%] size-[min(78vw,320px)] -translate-x-1/2 -translate-y-1/2 rounded-3xl border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]"
        aria-hidden
      >
        <div className="absolute inset-0 overflow-hidden rounded-3xl">
          <div className="absolute inset-x-4 top-0 h-0.5 animate-pulse bg-linear-to-r from-transparent via-teal-400 to-transparent" />
        </div>
        <span className="absolute -left-1 -top-1 size-8 rounded-tl-2xl border-l-4 border-t-4 border-teal-400" />
        <span className="absolute -right-1 -top-1 size-8 rounded-tr-2xl border-r-4 border-t-4 border-teal-400" />
        <span className="absolute -bottom-1 -left-1 size-8 rounded-bl-2xl border-b-4 border-l-4 border-teal-400" />
        <span className="absolute -bottom-1 -right-1 size-8 rounded-br-2xl border-b-4 border-r-4 border-teal-400" />
      </div>

      <header className="relative z-10 flex items-center justify-between gap-3 px-4 pt-3">
        <button
          type="button"
          onClick={onClose}
          className="flex size-11 items-center justify-center rounded-full bg-black/50 backdrop-blur-md"
          aria-label="Kapat"
        >
          <X className="size-5" />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="text-sm font-semibold">Tahta QR okut</p>
          <p className="text-[11px] text-white/70">Telefonda girişli hesabınızla onaylayın</p>
        </div>
        {torchAvail ? (
          <button
            type="button"
            onClick={() => void toggleTorch()}
            className="flex size-11 items-center justify-center rounded-full bg-black/50 backdrop-blur-md"
            aria-label={torchOn ? 'Flaş kapat' : 'Flaş aç'}
          >
            {torchOn ? <FlashlightOff className="size-5" /> : <Flashlight className="size-5" />}
          </button>
        ) : (
          <span className="size-11" aria-hidden />
        )}
      </header>

      <div className="relative z-10 mt-auto space-y-3 px-4 pb-4">
        {deviceHint ? (
          <p className="rounded-xl bg-violet-600/30 px-3 py-2 text-center text-xs text-violet-100">
            Bekleyen tahta: <strong>{deviceHint}</strong>
          </p>
        ) : null}

        {locked || busy ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl bg-teal-600/90 py-4 text-sm font-medium">
            <LoadingSpinner className="size-5 border-white/30 border-t-white" />
            Tahtaya bağlanıyor…
          </div>
        ) : !ready ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl bg-white/10 py-4 text-sm backdrop-blur-md">
            <LoadingSpinner className="size-5" />
            Kamera hazırlanıyor…
          </div>
        ) : (
          <p className="text-center text-xs text-white/80">
            QR kodu çerçeveye hizalayın; otomatik okunur. Işık yetersizse flaşı deneyin.
          </p>
        )}

        {err ? (
          <p className="rounded-xl bg-amber-500/20 px-3 py-2 text-center text-xs text-amber-100">{err}</p>
        ) : null}

        <button
          type="button"
          className="w-full rounded-2xl border border-white/20 bg-white/10 py-3 text-sm font-medium backdrop-blur-md"
          onClick={() => setPasteOpen((v) => !v)}
        >
          <ClipboardPaste className="mr-2 inline size-4" />
          Link yapıştır
        </button>

        {pasteOpen ? (
          <div className="space-y-2 rounded-2xl bg-white/10 p-3 backdrop-blur-md">
            <Input
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              placeholder="https://…/akilli-tahta?qr_school=…"
              className="border-white/20 bg-black/40 text-xs text-white placeholder:text-white/40"
            />
            <Button
              type="button"
              className="w-full"
              variant="secondary"
              disabled={busy || locked}
              onClick={() => void submitPaste()}
            >
              Onayla
            </Button>
          </div>
        ) : null}

        {err && !ready ? (
          <Button type="button" className="w-full" variant="default" onClick={() => void startCamera()}>
            Kamerayı tekrar aç
          </Button>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
