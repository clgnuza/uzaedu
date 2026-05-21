'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { cn } from '@/lib/utils';
import {
  detectOptikCameraHelpPlatform,
  loadOptikCameraSettings,
  openOptikCameraStream,
  optikCameraPermissionHelp,
  queryCameraPermission,
  saveOptikCameraSettings,
  smartBoardCameraErrorMessage,
  isSecureCameraContext,
  type CameraPermissionState,
  type OptikCameraFacing,
  type OptikCameraResolution,
  type OptikCameraSettings,
} from '@/lib/optik-camera-settings';
import { optikToast } from '@/lib/optik-toast';
import { toggleCameraTorch } from '@/lib/smart-board-qr-scanner';
import {
  Camera,
  ChevronDown,
  Flashlight,
  HelpCircle,
  Image,
  Layers,
  Monitor,
  RefreshCw,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  Smartphone,
  User,
  X,
} from 'lucide-react';

function PermDot({ state }: { state: CameraPermissionState }) {
  const title =
    state === 'granted'
      ? 'İzin verildi'
      : state === 'denied'
        ? 'İzin reddedildi'
        : 'İzin sorulacak';
  if (state === 'granted') {
    return (
      <span title={title}>
        <ShieldCheck className="size-4 text-emerald-600" />
      </span>
    );
  }
  if (state === 'denied') {
    return (
      <span title={title}>
        <ShieldAlert className="size-4 text-red-600" />
      </span>
    );
  }
  return (
    <span title={title}>
      <ShieldQuestion className="size-4 text-amber-600" />
    </span>
  );
}

function IconSelect({
  icon: Icon,
  title,
  value,
  onChange,
  children,
}: {
  icon: typeof Camera;
  title: string;
  value: string | number;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label
      title={title}
      className="flex flex-col items-center gap-0.5 rounded-lg border border-border/60 bg-background/80 px-1 py-1.5"
    >
      <Icon className="size-3.5 text-muted-foreground" />
      <select
        className="max-w-full truncate border-0 bg-transparent p-0 text-center text-[9px] font-semibold outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>
    </label>
  );
}

export function OptikCameraSettingsPanel({
  onSettingsChange,
  defaultOpen,
}: {
  onSettingsChange?: (s: OptikCameraSettings) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [settings, setSettings] = useState<OptikCameraSettings>(() => loadOptikCameraSettings());
  const [perm, setPerm] = useState<CameraPermissionState>('unknown');
  const [testing, setTesting] = useState(false);
  const [testErr, setTestErr] = useState<string | null>(null);
  const [previewOn, setPreviewOn] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const helpLines = optikCameraPermissionHelp(detectOptikCameraHelpPlatform());
  const secure = isSecureCameraContext();

  const refreshPerm = useCallback(async () => {
    setPerm(await queryCameraPermission());
  }, []);

  useEffect(() => {
    void refreshPerm();
  }, [refreshPerm]);

  const stopPreview = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setPreviewOn(false);
  }, []);

  useEffect(() => () => stopPreview(), [stopPreview]);

  const patch = (p: Partial<OptikCameraSettings>) => {
    const next = saveOptikCameraSettings(p);
    setSettings(next);
    onSettingsChange?.(next);
  };

  const runTest = async () => {
    setTesting(true);
    setTestErr(null);
    stopPreview();
    try {
      if (!secure) {
        const msg = 'HTTPS veya localhost gerekir';
        setTestErr(msg);
        optikToast.errorMsg('Güvenli bağlantı yok', msg);
        return;
      }
      const stream = await openOptikCameraStream(settings);
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
        setPreviewOn(true);
        if (settings.preferTorchOnStart) await toggleCameraTorch(stream, true);
      }
      await refreshPerm();
    } catch (e) {
      const msg = smartBoardCameraErrorMessage(e);
      setTestErr(msg);
      optikToast.cameraError(e);
      await refreshPerm();
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="rounded-xl border border-border/80 bg-card shadow-sm">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-2.5 py-2"
        onClick={() => setOpen((o) => !o)}
      >
        <Settings2 className="size-4 text-violet-600" />
        <span className="flex-1 text-left text-[11px] font-semibold">Kamera</span>
        <PermDot state={perm} />
        <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
      </button>

      {open ? (
        <div className="space-y-2 border-t px-2.5 py-2">
          {!secure ? (
            <p className="text-[10px] text-red-600" title="Güvenli bağlantı gerekir">
              HTTPS gerekli
            </p>
          ) : null}

          <div className="flex gap-1">
            <Button
              type="button"
              size="icon"
              title="Kamera testi"
              className="size-9 shrink-0 rounded-lg"
              disabled={testing}
              onClick={() => void runTest()}
            >
              {testing ? <LoadingSpinner className="size-3.5" /> : <Camera className="size-4" />}
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              title="İzin durumunu yenile"
              className="size-9 shrink-0 rounded-lg"
              onClick={() => void refreshPerm()}
            >
              <RefreshCw className="size-3.5" />
            </Button>
            {previewOn ? (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                title="Önizlemeyi kapat"
                className="size-9 shrink-0 rounded-lg"
                onClick={stopPreview}
              >
                <X className="size-4" />
              </Button>
            ) : null}
            <Button
              type="button"
              size="icon"
              variant="ghost"
              title="İzin yardımı"
              className="size-9 shrink-0 rounded-lg"
              onClick={() => setHelpOpen((h) => !h)}
            >
              <HelpCircle className="size-4" />
            </Button>
            <label
              title="Taramada flaşı aç"
              className="ml-auto flex size-9 cursor-pointer items-center justify-center rounded-lg border border-border/60"
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={settings.preferTorchOnStart}
                onChange={(e) => patch({ preferTorchOnStart: e.target.checked })}
              />
              <Flashlight
                className={cn(
                  'size-4',
                  settings.preferTorchOnStart ? 'text-amber-500' : 'text-muted-foreground',
                )}
              />
            </label>
          </div>

          {testErr ? <p className="truncate text-[10px] text-red-600">{testErr}</p> : null}

          <div className={cn('overflow-hidden rounded-lg bg-black', previewOn ? 'aspect-video max-h-36' : 'hidden')}>
            <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            <IconSelect
              icon={settings.facingMode === 'user' ? User : Smartphone}
              title="Ön / arka kamera"
              value={settings.facingMode}
              onChange={(v) => patch({ facingMode: v as OptikCameraFacing })}
            >
              <option value="environment">Arka</option>
              <option value="user">Ön</option>
            </IconSelect>
            <IconSelect
              icon={Monitor}
              title="Çözünürlük"
              value={settings.resolution}
              onChange={(v) => patch({ resolution: v as OptikCameraResolution })}
            >
              <option value="high">Yüksek</option>
              <option value="medium">Orta</option>
              <option value="low">Düşük</option>
            </IconSelect>
            <IconSelect
              icon={Layers}
              title="MC kare sayısı"
              value={settings.mcBurstFrames}
              onChange={(v) => patch({ mcBurstFrames: Number(v) as 1 | 2 | 3 })}
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </IconSelect>
            <IconSelect
              icon={Image}
              title="JPEG kalitesi"
              value={String(settings.jpegQuality)}
              onChange={(v) => patch({ jpegQuality: Number(v) })}
            >
              <option value="0.88">Std</option>
              <option value="0.9">İyi</option>
              <option value="0.94">Max</option>
            </IconSelect>
          </div>

          {helpOpen ? (
            <ul className="max-h-24 space-y-0.5 overflow-y-auto text-[9px] text-muted-foreground">
              {helpLines.map((line) => (
                <li key={line} title={line} className="truncate">
                  · {line}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
