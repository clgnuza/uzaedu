'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  MapPin,
  Monitor,
  Plus,
  Trash2,
  LockOpen,
  Lock,
  PowerOff,
  Layers,
  ImageIcon,
  ExternalLink,
  Pencil,
  Check,
  X,
  ChevronRight,
  GripVertical,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Device, Session } from '../types';

type DeviceDisplayStatus = 'open' | 'locked' | 'closed';
type FloorPlan = { label: string; url: string };

function getDeviceStatus(device: Device, activeDeviceIds: Set<string>): DeviceDisplayStatus {
  if (device.status !== 'online') return 'closed';
  if (activeDeviceIds.has(device.id)) return 'locked';
  return 'open';
}

const STATUS_CONFIG: Record<
  DeviceDisplayStatus,
  { label: string; short: string; icon: typeof LockOpen; dot: string; chip: string }
> = {
  open: {
    label: 'Açık',
    short: 'Çevrimiçi',
    icon: LockOpen,
    dot: 'bg-emerald-500',
    chip: 'bg-emerald-600 border-emerald-400 text-white',
  },
  locked: {
    label: 'Ders oturumu',
    short: 'Bağlı',
    icon: Lock,
    dot: 'bg-amber-500',
    chip: 'bg-amber-600 border-amber-400 text-white',
  },
  closed: {
    label: 'Kapalı',
    short: 'Çevrimdışı',
    icon: PowerOff,
    dot: 'bg-slate-400',
    chip: 'bg-slate-600 border-slate-400 text-white',
  },
};

function isUnpositioned(d: Device): boolean {
  return d.planPositionX == null && d.planPositionY == null;
}

const PLAN_IMAGE_PROBE_MS = 12_000;

function isAllowedPlanImageUrl(raw: string): boolean {
  const t = raw.trim();
  if (!t) return false;
  try {
    const u = new URL(t);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function safePlanImageSrc(raw: string | undefined): string | undefined {
  const t = raw?.trim();
  if (!t || !isAllowedPlanImageUrl(t)) return undefined;
  return t;
}

/** Kaydetmeden önce görselin tarayıcıda yüklenebildiğini doğrula. */
function probeFloorPlanImageUrl(url: string): Promise<{ ok: boolean; message?: string }> {
  if (!isAllowedPlanImageUrl(url)) {
    return Promise.resolve({
      ok: false,
      message: 'Yalnızca http:// veya https:// ile başlayan görsel adresi kullanın.',
    });
  }
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: { ok: boolean; message?: string }) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    const timer = window.setTimeout(
      () => finish({ ok: false, message: 'Görsel yanıt vermedi (zaman aşımı). URL veya erişimi kontrol edin.' }),
      PLAN_IMAGE_PROBE_MS,
    );
    const img = new Image();
    img.onload = () => {
      window.clearTimeout(timer);
      if (img.naturalWidth > 0 && img.naturalHeight > 0) finish({ ok: true });
      else finish({ ok: false, message: 'Görsel boş veya geçersiz.' });
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      finish({
        ok: false,
        message:
          'Görsel açılamadı. Doğrudan HTTPS PNG/JPG linki kullanın; bazı siteler hotlink / CORS engeller.',
      });
    };
    img.referrerPolicy = 'no-referrer';
    img.src = url;
  });
}

const CHECKERBOARD_BG =
  'bg-zinc-200 dark:bg-zinc-900 bg-[linear-gradient(45deg,#a1a1aa_25%,transparent_25%),linear-gradient(-45deg,#a1a1aa_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#a1a1aa_75%),linear-gradient(-45deg,transparent_75%,#a1a1aa_75%)] bg-size-[24px_24px] bg-position-[0_0,0_12px,12px_-12px,-12px_0px]';

export function FloorPlanEditor({
  devices,
  sessions,
  floorPlans,
  schoolId,
  canManage,
  token,
  onUpdateDevicePosition,
  onUpdateFloorPlans,
  onAssignDeviceToFloor,
}: {
  devices: Device[];
  sessions: Session[];
  floorPlans: FloorPlan[];
  schoolId: string;
  canManage: boolean;
  token: string | null;
  onUpdateDevicePosition: (deviceId: string, x: number, y: number, floorIndex?: number) => void;
  onUpdateFloorPlans: (plans: FloorPlan[]) => void;
  onAssignDeviceToFloor?: (deviceId: string, floorIndex: number) => void;
}) {
  const [savingUrl, setSavingUrl] = useState(false);
  const [urlValidating, setUrlValidating] = useState(false);
  const [newPlanLabel, setNewPlanLabel] = useState('');
  const [newPlanUrl, setNewPlanUrl] = useState('');
  const [newUrlPreview, setNewUrlPreview] = useState<'idle' | 'checking' | 'ok' | 'fail'>('idle');
  const [planImageLoad, setPlanImageLoad] = useState<'loading' | 'ready' | 'error'>('loading');
  const [activeFloor, setActiveFloor] = useState(0);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [editingFloorIndex, setEditingFloorIndex] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const floorListEndRef = useRef<HTMLLIElement | null>(null);
  const lastPosRef = useRef<{ x: number; y: number }>({ x: 10, y: 10 });
  const onUpdateRef = useRef(onUpdateDevicePosition);
  const draggingIdRef = useRef<string | null>(null);
  onUpdateRef.current = onUpdateDevicePosition;
  draggingIdRef.current = draggingId;

  useEffect(() => {
    if (activeFloor >= floorPlans.length && floorPlans.length > 0) {
      setActiveFloor(Math.max(0, floorPlans.length - 1));
    }
  }, [floorPlans.length, activeFloor]);

  const activeDeviceIds = useMemo(
    () => new Set(sessions.filter((s) => s.is_active).map((s) => s.device_id)),
    [sessions],
  );

  const stats = useMemo(() => {
    const placed = devices.filter((d) => !isUnpositioned(d)).length;
    const online = devices.filter((d) => d.status === 'online').length;
    const active = devices.filter((d) => activeDeviceIds.has(d.id)).length;
    return { placed, online, active, total: devices.length };
  }, [devices, activeDeviceIds]);

  const handleSavePlans = useCallback(
    async (plans: FloorPlan[]) => {
      if (!token || !canManage) return;
      setSavingUrl(true);
      try {
        await apiFetch(`/schools/${schoolId}`, {
          method: 'PATCH',
          body: JSON.stringify({ smart_board_floor_plans: plans }),
          token,
        });
        onUpdateFloorPlans(plans);
        toast.success('Kat planları kaydedildi.');
      } catch {
        toast.error('Kaydedilemedi.');
      } finally {
        setSavingUrl(false);
      }
    },
    [token, schoolId, canManage, onUpdateFloorPlans],
  );

  const validateAndSavePlans = useCallback(
    async (plans: FloorPlan[], opts?: { activateIndex?: number; onDone?: () => void }) => {
      const last = plans[plans.length - 1];
      if (!last?.url?.trim()) {
        toast.error('Görsel URL gerekli.');
        return false;
      }
      setUrlValidating(true);
      const probe = await probeFloorPlanImageUrl(last.url.trim());
      setUrlValidating(false);
      if (!probe.ok) {
        toast.error(probe.message ?? 'Görsel doğrulanamadı; kayıt yapılmadı.');
        return false;
      }
      await handleSavePlans(plans);
      if (opts?.activateIndex != null) setActiveFloor(opts.activateIndex);
      opts?.onDone?.();
      return true;
    },
    [handleSavePlans],
  );

  const handleAddPlan = useCallback(async () => {
    const label = newPlanLabel.trim() || `Kat ${floorPlans.length + 1}`;
    const url = newPlanUrl.trim();
    if (!url) {
      toast.error('Görsel URL girin.');
      return;
    }
    if (newUrlPreview !== 'ok') {
      setUrlValidating(true);
      const probe = await probeFloorPlanImageUrl(url);
      setUrlValidating(false);
      if (!probe.ok) {
        toast.error(probe.message ?? 'Görsel doğrulanamadı.');
        setNewUrlPreview('fail');
        return;
      }
      setNewUrlPreview('ok');
    }
    const plans = [...floorPlans, { label, url }];
    const newIndex = plans.length - 1;
    const ok = await validateAndSavePlans(plans, {
      activateIndex: newIndex,
      onDone: () => {
        setNewPlanLabel('');
        setNewPlanUrl('');
        setNewUrlPreview('idle');
        requestAnimationFrame(() => {
          floorListEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
      },
    });
    if (!ok) return;
  }, [floorPlans, newPlanLabel, newPlanUrl, newUrlPreview, validateAndSavePlans]);

  const handleRemovePlan = useCallback(
    (index: number) => {
      if (!confirm(`"${floorPlans[index]?.label}" kat planını silmek istiyor musunuz?`)) return;
      const plans = floorPlans.filter((_, i) => i !== index);
      void handleSavePlans(plans);
      if (activeFloor >= plans.length) setActiveFloor(Math.max(0, plans.length - 1));
    },
    [floorPlans, handleSavePlans, activeFloor],
  );

  const startEditFloor = (index: number) => {
    setEditingFloorIndex(index);
    setEditLabel(floorPlans[index]?.label ?? '');
    setEditUrl(floorPlans[index]?.url ?? '');
  };

  const saveEditFloor = async () => {
    if (editingFloorIndex == null) return;
    const url = editUrl.trim();
    if (!url) {
      toast.error('URL boş olamaz.');
      return;
    }
    const prevUrl = floorPlans[editingFloorIndex]?.url?.trim();
    if (url !== prevUrl) {
      setUrlValidating(true);
      const probe = await probeFloorPlanImageUrl(url);
      setUrlValidating(false);
      if (!probe.ok) {
        toast.error(probe.message ?? 'Görsel doğrulanamadı; değişiklik kaydedilmedi.');
        return;
      }
    }
    const plans = floorPlans.map((p, i) =>
      i === editingFloorIndex ? { label: editLabel.trim() || p.label, url } : p,
    );
    await handleSavePlans(plans);
    setEditingFloorIndex(null);
    setPlanImageLoad('loading');
  };

  const getDevicesForFloor = useCallback(
    (floorIndex: number) =>
      devices.filter((d) => {
        const idx = d.planFloorIndex ?? 0;
        return idx === floorIndex || (idx >= floorPlans.length && floorIndex === 0);
      }),
    [devices, floorPlans.length],
  );

  /** Haritada yalnızca bu kata atanmış tahtalar. */
  const floorDevices = useMemo(() => getDevicesForFloor(activeFloor), [getDevicesForFloor, activeFloor]);
  const otherFloorCount = useMemo(
    () => devices.filter((d) => (d.planFloorIndex ?? 0) !== activeFloor).length,
    [devices, activeFloor],
  );
  const unpositionedDevices = useMemo(() => devices.filter(isUnpositioned), [devices]);
  const sortedDevicesForList = useMemo(() => {
    const rank = (d: Device) => {
      const unpos = isUnpositioned(d);
      const onFloor = (d.planFloorIndex ?? 0) === activeFloor;
      if (unpos) return 0;
      if (onFloor) return 1;
      return 2;
    };
    return [...devices].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, 'tr'));
  }, [devices, activeFloor]);

  const placeDeviceOnActiveFloor = useCallback(
    async (device: Device) => {
      if (!canManage || floorPlans.length === 0) return;
      const onFloor = devices.filter(
        (d) => !isUnpositioned(d) && (d.planFloorIndex ?? 0) === activeFloor,
      );
      const slot = onFloor.length;
      const x = Math.min(88, 10 + (slot % 6) * 14);
      const y = Math.min(88, 10 + Math.floor(slot / 6) * 12);
      if ((device.planFloorIndex ?? 0) !== activeFloor && onAssignDeviceToFloor) {
        await Promise.resolve(onAssignDeviceToFloor(device.id, activeFloor));
      }
      await Promise.resolve(onUpdateDevicePosition(device.id, x, y, activeFloor));
      setSelectedDeviceId(device.id);
    },
    [canManage, floorPlans.length, devices, activeFloor, onAssignDeviceToFloor, onUpdateDevicePosition],
  );

  const handleMarkerMouseDown = useCallback(
    (e: React.MouseEvent, device: Device) => {
      if (!canManage) return;
      e.preventDefault();
      setSelectedDeviceId(device.id);
      lastPosRef.current = {
        x: device.planPositionX ?? 10,
        y: device.planPositionY ?? 10,
      };
      setDraggingId(device.id);
    },
    [canManage],
  );

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      const id = draggingIdRef.current;
      if (id) {
        const { x, y } = lastPosRef.current;
        onUpdateRef.current(id, Math.round(x * 100) / 100, Math.round(y * 100) / 100, activeFloor);
        setDraggingId(null);
        setDropPosition(null);
      }
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [activeFloor]);

  const activePlan = floorPlans[activeFloor];

  const activePlanImageSrc = safePlanImageSrc(activePlan?.url);

  useEffect(() => {
    if (!activePlanImageSrc) {
      setPlanImageLoad('error');
      return;
    }
    setPlanImageLoad('loading');
  }, [activeFloor, activePlanImageSrc]);

  useEffect(() => {
    const url = newPlanUrl.trim();
    if (!url) {
      setNewUrlPreview('idle');
      return;
    }
    setNewUrlPreview('checking');
    const t = window.setTimeout(() => {
      void probeFloorPlanImageUrl(url).then((r) => setNewUrlPreview(r.ok ? 'ok' : 'fail'));
    }, 500);
    return () => clearTimeout(t);
  }, [newPlanUrl]);

  return (
    <div className="space-y-4 pb-6">
      {/* Üst şerit */}
      <div className="overflow-hidden rounded-2xl border border-amber-200/50 bg-linear-to-br from-amber-500/10 via-background to-orange-500/5 dark:border-amber-900/40">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-base font-semibold sm:text-lg">
              <span className="flex size-9 items-center justify-center rounded-xl bg-amber-500/15 ring-1 ring-amber-500/25">
                <MapPin className="size-4 text-amber-800 dark:text-amber-200" />
              </span>
              Kroki ve yerleşim
            </h2>
            <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-muted-foreground sm:text-sm">
              Okul kat planı üzerinde tahtaları konumlandırın. Rozetleri sürükleyin; durum renkleri canlı
              güncellenir.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            {[
              { label: 'Kat planı', value: floorPlans.length, sub: 'görsel' },
              { label: 'Tahta', value: stats.total, sub: `${stats.placed} konumlu` },
              { label: 'Çevrimiçi', value: stats.online, sub: 'açık tahta' },
              { label: 'Ders oturumu', value: stats.active, sub: 'şu an bağlı' },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-amber-200/40 bg-card/80 px-3 py-2 backdrop-blur-sm dark:border-amber-900/35"
              >
                <p className="text-[10px] font-medium text-muted-foreground">{s.label}</p>
                <p className="text-xl font-bold tabular-nums tracking-tight">{s.value}</p>
                <p className="text-[9px] text-muted-foreground">{s.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {devices.length === 0 ? (
        <Alert variant="info">
          Yerleştirilecek tahta yok.{' '}
          <Link href="/akilli-tahta?tab=cihazlar" className="font-medium text-primary underline">
            Cihazlar
          </Link>{' '}
          sekmesinden tahta ekleyin.
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(272px,300px)_1fr] lg:items-stretch">
        <aside className="flex max-h-[min(78vh,820px)] flex-col gap-2 lg:sticky lg:top-4">
          <Card className="shrink-0 overflow-hidden border-amber-200/35 shadow-sm dark:border-amber-900/30">
            <CardHeader className="border-b border-border/50 bg-amber-500/5 px-3 py-2.5">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Layers className="size-4 text-amber-700 dark:text-amber-300" />
                Kat planları
                <span className="ml-auto text-[10px] font-normal text-muted-foreground">
                  {floorPlans.length > 0 ? activePlan?.label : '—'}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2 py-2">
              {floorPlans.length === 0 ? (
                <p className="rounded-lg border border-dashed px-2 py-3 text-center text-[11px] text-muted-foreground">
                  Plan yok — alttan ekleyin.
                </p>
              ) : (
                <ul className="max-h-36 space-y-1 overflow-y-auto pr-0.5">
                  {floorPlans.map((plan, i) => (
                    <li key={i} ref={i === floorPlans.length - 1 ? floorListEndRef : undefined}>
                      {editingFloorIndex === i ? (
                        <div className="space-y-2 rounded-lg border border-primary/30 bg-muted/30 p-2">
                          <Input
                            value={editLabel}
                            onChange={(e) => setEditLabel(e.target.value)}
                            placeholder="Kat adı"
                            className="h-8 text-xs"
                          />
                          <Input
                            value={editUrl}
                            onChange={(e) => setEditUrl(e.target.value)}
                            placeholder="https://…"
                            className="h-8 text-xs"
                          />
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              className="h-7 flex-1 text-xs"
                              onClick={() => void saveEditFloor()}
                              disabled={savingUrl || urlValidating}
                            >
                              <Check className="size-3.5" />
                              Kaydet
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2"
                              onClick={() => setEditingFloorIndex(null)}
                            >
                              <X className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => setActiveFloor(i)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setActiveFloor(i);
                            }
                          }}
                          className={cn(
                            'flex w-full cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition-colors hover:bg-muted/40',
                            activeFloor === i
                              ? 'border-amber-500/50 bg-amber-500/12 font-medium text-amber-950 dark:text-amber-50'
                              : 'border-transparent bg-muted/20',
                          )}
                        >
                          <ImageIcon className="size-3.5 shrink-0 opacity-70" />
                          <span className="min-w-0 flex-1 truncate">{plan.label}</span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">
                            {getDevicesForFloor(i).length}
                          </span>
                          {canManage ? (
                            <span className="flex shrink-0 gap-0.5" onClick={(e) => e.stopPropagation()}>
                              <span
                                role="button"
                                tabIndex={0}
                                aria-label="Düzenle"
                                className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md hover:bg-background/80"
                                onClick={() => startEditFloor(i)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    startEditFloor(i);
                                  }
                                }}
                              >
                                <Pencil className="size-3" />
                              </span>
                              <span
                                role="button"
                                tabIndex={0}
                                aria-label="Sil"
                                className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-destructive hover:bg-background/80"
                                onClick={() => handleRemovePlan(i)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    handleRemovePlan(i);
                                  }
                                }}
                              >
                                <Trash2 className="size-3" />
                              </span>
                            </span>
                          ) : null}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {floorPlans.length > 0 ? (
            <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border-border/60 shadow-sm">
              <CardHeader className="shrink-0 space-y-1 border-b border-border/40 px-3 py-2">
                <CardTitle className="text-xs font-semibold">
                  Tahtalar · {activePlan?.label}
                </CardTitle>
                <p className="text-[10px] text-muted-foreground">
                  {unpositionedDevices.length > 0
                    ? `${unpositionedDevices.length} konumsuz — «Plana ekle» veya haritada sürükleyin.`
                    : otherFloorCount > 0
                      ? `${otherFloorCount} tahta başka katta.`
                      : 'Tümü bu katta.'}
                </p>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 py-2">
                {sortedDevicesForList.map((d) => {
                  const onThisFloor = (d.planFloorIndex ?? 0) === activeFloor;
                  const unpos = isUnpositioned(d);
                  const status = getDeviceStatus(d, activeDeviceIds);
                  const cfg = STATUS_CONFIG[status];
                  const needsPlace = unpos || !onThisFloor;
                  return (
                    <div
                      key={d.id}
                      className={cn(
                        'rounded-lg border px-2 py-1.5',
                        selectedDeviceId === d.id
                          ? 'border-primary/40 bg-primary/8'
                          : 'border-border/50 bg-muted/15',
                        needsPlace && 'border-amber-400/40 bg-amber-500/5',
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={cn('size-2 shrink-0 rounded-full', cfg.dot)} />
                        <button
                          type="button"
                          onClick={() => setSelectedDeviceId(d.id)}
                          className="min-w-0 flex-1 truncate text-left text-[11px] font-medium hover:underline"
                        >
                          {d.name}
                        </button>
                        {canManage && needsPlace ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="h-6 shrink-0 px-2 text-[10px]"
                            onClick={() => void placeDeviceOnActiveFloor(d)}
                          >
                            <MapPin className="size-3" />
                            Plana ekle
                          </Button>
                        ) : null}
                      </div>
                      {(d.classSection || !onThisFloor) && (
                        <p className="mt-0.5 truncate pl-3.5 text-[10px] text-muted-foreground">
                          {d.classSection ? `${d.classSection}` : ''}
                          {!onThisFloor && floorPlans.length > 0
                            ? `${d.classSection ? ' · ' : ''}Kat: ${floorPlans[d.planFloorIndex ?? 0]?.label ?? d.planFloorIndex}`
                            : ''}
                          {unpos ? `${d.classSection || !onThisFloor ? ' · ' : ''}Konumsuz` : ''}
                        </p>
                      )}
                      {canManage && floorPlans.length > 1 && onAssignDeviceToFloor ? (
                        <div className="mt-1 pl-3.5">
                          <Select
                            value={String(d.planFloorIndex ?? 0)}
                            onValueChange={(v) => onAssignDeviceToFloor(d.id, Number(v))}
                          >
                            <SelectTrigger className="h-7 w-full text-[10px]">
                              <SelectValue placeholder="Kat" />
                            </SelectTrigger>
                            <SelectContent>
                              {floorPlans.map((fp, fi) => (
                                <SelectItem key={fi} value={String(fi)}>
                                  {fp.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ) : null}

          {canManage ? (
            <Card className="mt-auto shrink-0 border-amber-200/35 shadow-sm dark:border-amber-900/30">
              <CardHeader className="px-3 py-2">
                <CardTitle className="text-xs font-semibold">Yeni kat planı</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 px-3 pb-3">
                <Input
                  placeholder="Zemin, 1. kat…"
                  value={newPlanLabel}
                  onChange={(e) => setNewPlanLabel(e.target.value)}
                  className="h-8 text-xs"
                />
                <Input
                  placeholder="https://… PNG/JPG"
                  value={newPlanUrl}
                  onChange={(e) => setNewPlanUrl(e.target.value)}
                  className="h-8 text-xs"
                />
                {safePlanImageSrc(newPlanUrl) && newUrlPreview === 'ok' ? (
                  <div className="overflow-hidden rounded-lg border border-emerald-500/50">
                    <div className={cn('relative h-20 w-full', CHECKERBOARD_BG)}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={safePlanImageSrc(newPlanUrl)}
                        alt="Önizleme"
                        className="absolute inset-0 h-full w-full object-contain p-1"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  </div>
                ) : newPlanUrl.trim() ? (
                  <p className="text-center text-[10px] text-muted-foreground">
                    {newUrlPreview === 'checking' ? 'Görsel kontrol ediliyor…' : 'Geçerli HTTPS görsel gerekli'}
                  </p>
                ) : null}
                <Button
                  className="h-8 w-full gap-1 text-xs"
                  onClick={() => void handleAddPlan()}
                  disabled={savingUrl || urlValidating || !newPlanUrl.trim() || newUrlPreview === 'fail'}
                >
                  {savingUrl || urlValidating ? (
                    <LoadingSpinner className="size-3.5" />
                  ) : (
                    <Plus className="size-3.5" />
                  )}
                  Plan ekle ve haritada aç
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </aside>

        <Card className="overflow-hidden border-border/60 shadow-md lg:min-h-[min(78vh,820px)]">
          <CardHeader className="flex flex-row items-center justify-between gap-2 border-b border-border/50 bg-muted/20 px-4 py-3">
            <div className="min-w-0">
              <CardTitle className="truncate text-sm sm:text-base">
                {activePlan?.label ?? 'Kat planı'}
              </CardTitle>
              <CardDescription className="text-xs">
                {canManage ? 'Rozetleri sürükleyerek konumlandırın' : 'Salt okunur görünüm'}
              </CardDescription>
            </div>
            {activePlanImageSrc ? (
              <a
                href={activePlanImageSrc}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1 text-xs text-primary hover:underline"
              >
                Görsel
                <ExternalLink className="size-3" />
              </a>
            ) : null}
          </CardHeader>
          <CardContent className="p-2 sm:p-4">
            {floorPlans.length === 0 ? (
              <div className="flex min-h-[min(50vh,420px)] flex-col items-center justify-center rounded-xl border border-dashed border-muted-foreground/25 bg-muted/15 p-8">
                <MapPin className="mb-3 size-12 text-muted-foreground/50" />
                <p className="max-w-sm text-center text-sm text-muted-foreground">
                  {canManage
                    ? 'Sol panelden kat planı görseli ekleyin (ör. okul mimari planı PNG).'
                    : 'Kat planı henüz tanımlanmamış.'}
                </p>
                {canManage ? (
                  <Button variant="outline" size="sm" className="mt-4" asChild>
                    <Link href="/akilli-tahta?tab=cihazlar">
                      Cihazlara git
                      <ChevronRight className="size-4" />
                    </Link>
                  </Button>
                ) : null}
              </div>
            ) : (
              <div
                ref={containerRef}
                className={cn(
                  'relative h-[min(70vh,640px)] min-h-[420px] w-full overflow-hidden rounded-xl border-2 border-amber-200/60 shadow-inner dark:border-amber-900/40',
                  CHECKERBOARD_BG,
                )}
                onMouseMove={(e) => {
                  if (!draggingId || !containerRef.current || planImageLoad !== 'ready') return;
                  const rect = containerRef.current.getBoundingClientRect();
                  let x = ((e.clientX - rect.left) / rect.width) * 100;
                  let y = ((e.clientY - rect.top) / rect.height) * 100;
                  x = Math.max(2, Math.min(98, x));
                  y = Math.max(2, Math.min(98, y));
                  lastPosRef.current = { x, y };
                  setDropPosition({ x, y });
                }}
              >
                {planImageLoad === 'loading' ? (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background/40 backdrop-blur-[1px]">
                    <LoadingSpinner className="size-8" />
                    <p className="text-xs text-muted-foreground">Plan görseli yükleniyor…</p>
                  </div>
                ) : null}
                {planImageLoad === 'error' ? (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-destructive/5 p-6 text-center">
                    <ImageIcon className="size-10 text-destructive/70" />
                    <p className="max-w-md text-sm font-medium text-destructive">
                      Plan görseli görüntülenemiyor
                    </p>
                    <p className="max-w-md text-xs text-muted-foreground">
                      URL hatalı veya site dış bağlantıyı engelliyor. Sol panelden düzenleyin veya doğrudan
                      PNG/JPG HTTPS linki kullanın.
                    </p>
                    {canManage ? (
                      <Button size="sm" variant="outline" onClick={() => startEditFloor(activeFloor)}>
                        URL düzenle
                      </Button>
                    ) : null}
                  </div>
                ) : null}
                {activePlanImageSrc ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    key={activePlanImageSrc}
                    src={activePlanImageSrc}
                    alt={activePlan.label}
                    className={cn(
                      'pointer-events-none absolute inset-0 z-[1] h-full w-full object-contain p-2 transition-opacity duration-300',
                      planImageLoad === 'ready' ? 'opacity-100' : 'opacity-0',
                    )}
                    draggable={false}
                    referrerPolicy="no-referrer"
                    onLoad={() => setPlanImageLoad('ready')}
                    onError={() => setPlanImageLoad('error')}
                  />
                ) : null}
                {planImageLoad === 'ready' ? (
                  <p className="pointer-events-none absolute bottom-2 left-2 z-[2] rounded-md bg-black/55 px-2 py-1 text-[10px] text-white">
                    Tahtayı plan üzerinde sürükleyin
                  </p>
                ) : null}
                {planImageLoad === 'ready'
                  ? floorDevices.map((d) => {
                    const x = d.planPositionX ?? 10;
                    const y = d.planPositionY ?? 10;
                    const isDragging = draggingId === d.id;
                    const isSelected = selectedDeviceId === d.id;
                    const status = getDeviceStatus(d, activeDeviceIds);
                    const cfg = STATUS_CONFIG[status];
                    const StatusIcon = cfg.icon;
                    return (
                      <div
                        key={d.id}
                        className={cn(
                          'absolute z-[3] flex min-w-[3.5rem] max-w-[5.5rem] -translate-x-1/2 -translate-y-1/2 flex-col items-center rounded-lg border px-1 py-1 text-[9px] font-semibold leading-tight shadow-lg transition-[transform,box-shadow,z-index,opacity]',
                          cfg.chip,
                          canManage ? 'cursor-grab active:cursor-grabbing' : 'cursor-default',
                          isDragging && 'z-30 scale-105 opacity-100 ring-2 ring-white/50',
                          isSelected && !isDragging && 'z-20 opacity-100 ring-2 ring-white/70 ring-offset-1 ring-offset-black/20',
                        )}
                      style={{
                        left: `${isDragging && dropPosition ? dropPosition.x : x}%`,
                        top: `${isDragging && dropPosition ? dropPosition.y : y}%`,
                      }}
                      onMouseDown={(e) => handleMarkerMouseDown(e, d)}
                      title={`${d.name}${d.classSection ? ` · ${d.classSection}` : ''} — ${cfg.label}`}
                    >
                      {canManage ? (
                        <GripVertical className="mb-0.5 size-2.5 opacity-70" aria-hidden />
                      ) : null}
                      <span className="flex items-center gap-0.5">
                        <Monitor className="size-2.5" />
                        <StatusIcon className="size-2.5" />
                      </span>
                      <span className="line-clamp-2 w-full text-center">{d.name}</span>
                      {d.classSection ? (
                        <span className="line-clamp-1 w-full text-center text-[8px] font-normal opacity-90">
                          {d.classSection}
                        </span>
                      ) : null}
                    </div>
                  );
                  })
                  : null}
              </div>
            )}
          </CardContent>
          <div className="flex flex-wrap gap-2 border-t border-border/50 px-3 py-2 text-[10px] text-muted-foreground">
            {(Object.keys(STATUS_CONFIG) as DeviceDisplayStatus[]).map((k) => {
              const c = STATUS_CONFIG[k];
              const I = c.icon;
              return (
                <span key={k} className={cn('inline-flex items-center gap-1 rounded px-1.5 py-0.5', c.chip)}>
                  <I className="size-2.5" />
                  {c.label}
                </span>
              );
            })}
          </div>
        </Card>
      </div>

      {devices.length > 0 && floorPlans.length === 0 && canManage ? (
        <Alert variant="info">
          Tahtalar hazır; yerleşim için en az bir kat planı görseli ekleyin.
        </Alert>
      ) : null}
    </div>
  );
}
