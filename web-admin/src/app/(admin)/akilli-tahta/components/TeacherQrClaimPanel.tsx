'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Camera, ClipboardPaste, QrCode } from 'lucide-react';
import { parseSmartBoardQrClaimUrl } from '@/lib/smart-board-qr-parse';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function TeacherQrClaimPanel({
  onClaim,
  busy,
  deviceHint,
  highlight,
}: {
  onClaim: (params: { school_id: string; device_id: string; session_id: string; code: string }) => Promise<void>;
  busy?: boolean;
  deviceHint?: string | null;
  highlight?: boolean;
}) {
  const [paste, setPaste] = useState('');
  const [scanOn, setScanOn] = useState(false);
  const [scanErr, setScanErr] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const loopRef = useRef<number | null>(null);

  const stopCamera = useCallback(() => {
    if (loopRef.current != null) {
      cancelAnimationFrame(loopRef.current);
      loopRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const closeScan = useCallback(() => {
    stopCamera();
    setScanOn(false);
  }, [stopCamera]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const submitPaste = async () => {
    const p = parseSmartBoardQrClaimUrl(paste);
    if (!p) {
      toast.error('Geçerli QR linki değil (qr_school, qr_device, qr_session, qr_code gerekli).');
      return;
    }
    await onClaim(p);
    setPaste('');
  };

  useEffect(() => {
    if (!scanOn) return;
    setScanErr(null);
    let cancelled = false;

    const run = async () => {
      if (!('BarcodeDetector' in window)) {
        setScanErr('Kamera QR bu tarayıcıda yok. Linki yapıştırın veya PWA ile paneli açın.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        const detector = new (window as unknown as { BarcodeDetector: new (o: { formats: string[] }) => {
          detect: (src: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
        } }).BarcodeDetector({ formats: ['qr_code'] });

        const tick = async () => {
          if (cancelled || !scanOn) return;
          try {
            const codes = await detector.detect(video);
            const raw = codes[0]?.rawValue;
            if (raw) {
              const p = parseSmartBoardQrClaimUrl(raw);
              if (p) {
                closeScan();
                await onClaim(p);
                return;
              }
            }
          } catch {
            /* frame skip */
          }
          loopRef.current = requestAnimationFrame(() => void tick());
        };
        loopRef.current = requestAnimationFrame(() => void tick());
      } catch (e) {
        setScanErr(e instanceof Error ? e.message : 'Kamera açılamadı');
      }
    };

    void run();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [scanOn, onClaim, stopCamera, closeScan]);

  return (
    <Card
      id="smart-board-qr-claim"
      className={cn(
        'mb-3 border-violet-200/50 bg-violet-500/5 dark:border-violet-900/40 sm:mb-5',
        highlight && 'ring-2 ring-violet-500/60',
      )}
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <QrCode className="size-4 text-violet-600" />
          Tahta kullanımı (QR onay)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <p className="text-xs text-muted-foreground">
          Ders için tahtada «Öğretmen girişi» QR’ını okutun veya linki yapıştırın. Onay sonrası tahta duyuru modundan çıkar. Süre dolarsa tahtada
          yeni QR üretin.
          {deviceHint ? (
            <>
              {' '}
              Bekleyen: <strong className="text-foreground">{deviceHint}</strong>
            </>
          ) : null}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            placeholder="https://…/akilli-tahta?qr_school=…"
            className="text-xs"
          />
          <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => void submitPaste()}>
            <ClipboardPaste className="size-4" />
            Onayla
          </Button>
        </div>
        {!scanOn ? (
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setScanOn(true)}>
            <Camera className="size-4" />
            Kamera ile oku
          </Button>
        ) : (
          <div className="space-y-2">
            <video ref={videoRef} className="mx-auto max-h-48 w-full rounded-lg bg-black object-contain" muted playsInline />
            {scanErr ? <p className="text-xs text-amber-700 dark:text-amber-200">{scanErr}</p> : null}
            <Button type="button" variant="ghost" size="sm" onClick={closeScan}>
              Kamerayı kapat
            </Button>
          </div>
        )}
        {busy ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <LoadingSpinner className="size-4" />
            QR onayı gönderiliyor…
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
