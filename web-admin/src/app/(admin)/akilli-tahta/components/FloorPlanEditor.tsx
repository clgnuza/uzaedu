'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { MapPin, Monitor, Plus, Trash2, LockOpen, Lock, PowerOff } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import type { Device, Session } from '../types';

type DeviceDisplayStatus = 'open' | 'locked' | 'closed';

function getDeviceStatus(device: Device, activeDeviceIds: Set<string>): DeviceDisplayStatus {
  if (device.status !== 'online') return 'closed';
  if (activeDeviceIds.has(device.id)) return 'locked';
  return 'open';
}

const STATUS_CONFIG: Record<
  DeviceDisplayStatus,
  { label: string; icon: typeof LockOpen; bg: string; border: string; text: string }
> = {
  open: {
    label: 'Açık',
    icon: LockOpen,
    bg: 'bg-emerald-600 dark:bg-emerald-700',
    border: 'border-emerald-400',
    text: 'text-white',
  },
  locked: {
    label: 'Kilitli',
    icon: Lock,
    bg: 'bg-amber-600 dark:bg-amber-700',
    border: 'border-amber-400',
    text: 'text-white',
  },
  closed: {
    label: 'Kapalı',
    icon: PowerOff,
    bg: 'bg-slate-500 dark:bg-slate-600',
    border: 'border-slate-400',
    text: 'text-white',
  },
};

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
  floorPlans: { label: string; url: string }[];
  schoolId: string;
  canManage: boolean;
  token: string | null;
  onUpdateDevicePosition: (deviceId: string, x: number, y: number, floorIndex?: number) => void;
  onUpdateFloorPlans: (plans: { label: string; url: string }[]) => void;
  onAssignDeviceToFloor?: (deviceId: string, floorIndex: number) => void;
}) {
  const [savingUrl, setSavingUrl] = useState(false);
  const [newPlanLabel, setNewPlanLabel] = useState('');
  const [newPlanUrl, setNewPlanUrl] = useState('');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draggingFloorIndex, setDraggingFloorIndex] = useState<number>(0);
  const [dropPosition, setDropPosition] = useState<{ x: number; y: number } | null>(null);
  const containerRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());
  const lastPosRef = useRef<{ x: number; y: number }>({ x: 10, y: 10 });
  const onUpdateRef = useRef(onUpdateDevicePosition);
  const draggingIdRef = useRef<string | null>(null);
  const draggingFloorRef = useRef<number>(0);
  onUpdateRef.current = onUpdateDevicePosition;
  draggingIdRef.current = draggingId;
  draggingFloorRef.current = draggingFloorIndex;

  const handleSavePlans = useCallback(
    async (plans: { label: string; url: string }[]) => {
      if (!token || !canManage) return;
      setSavingUrl(true);
      try {
        await apiFetch(`/schools/${schoolId}`, {
          method: 'PATCH',
          body: JSON.stringify({ smart_board_floor_plans: plans }),
          token,
        });
        onUpdateFloorPlans(plans);
        toast.success('Kat planları güncellendi.');
      } catch {
        toast.error('Kaydedilemedi.');
      } finally {
        setSavingUrl(false);
      }
    },
    [token, schoolId, canManage, onUpdateFloorPlans]
  );

  const handleAddPlan = useCallback(() => {
    const label = newPlanLabel.trim() || 'Yeni Kat';
    const url = newPlanUrl.trim();
    if (!url) {
      toast.error('URL girin.');
      return;
    }
    const plans = [...floorPlans, { label, url }];
    handleSavePlans(plans);
    setNewPlanLabel('');
    setNewPlanUrl('');
  }, [floorPlans, newPlanLabel, newPlanUrl, handleSavePlans]);

  const handleRemovePlan = useCallback(
    (index: number) => {
      if (!confirm('Bu kat planını silmek istediğinize emin misiniz?')) return;
      const plans = floorPlans.filter((_, i) => i !== index);
      handleSavePlans(plans);
    },
    [floorPlans, handleSavePlans]
  );

  const activeDeviceIds = new Set(
    sessions.filter((s) => s.is_active).map((s) => s.device_id)
  );

  const getDevicesForFloor = useCallback(
    (floorIndex: number) =>
      devices.filter((d) => {
        const idx = d.planFloorIndex ?? 0;
        return idx === floorIndex || (idx >= floorPlans.length && floorIndex === 0);
      }),
    [devices, floorPlans.length]
  );

  const handleMarkerMouseDown = useCallback(
    (e: React.MouseEvent, device: Device, floorIndex: number) => {
      if (!canManage) return;
      e.preventDefault();
      lastPosRef.current = {
        x: device.planPositionX ?? 10,
        y: device.planPositionY ?? 10,
      };
      setDraggingId(device.id);
      setDraggingFloorIndex(floorIndex);
    },
    [canManage]
  );

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      const id = draggingIdRef.current;
      if (id) {
        const { x, y } = lastPosRef.current;
        const floorIndex = draggingFloorRef.current;
        onUpdateRef.current(id, Math.round(x * 100) / 100, Math.round(y * 100) / 100, floorIndex);
        setDraggingId(null);
        setDropPosition(null);
      }
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  return (
    <Card className="mb-1 overflow-hidden border-amber-200/45 dark:border-amber-900/35 sm:mb-0">
      <CardHeader className="border-b border-amber-200/40 bg-amber-500/6 px-3 py-2.5 dark:border-amber-900/40 sm:px-6 sm:py-4">
        <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
          <span className="flex size-7 items-center justify-center rounded-lg bg-amber-500/15 sm:size-8">
            <MapPin className="size-3.5 text-amber-800 dark:text-amber-300 sm:size-4" />
          </span>
          Kroki ve yerleşim
        </CardTitle>
        <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-muted-foreground sm:mt-1 sm:line-clamp-none sm:text-sm">
          Kat planı URL’si ekleyin; tahtaları sürükleyin.
        </p>
      </CardHeader>
      <CardContent className="space-y-3 px-2.5 py-3 sm:space-y-6 sm:px-6 sm:py-6">
        {canManage && (
          <div className="space-y-2 rounded-lg border border-amber-200/40 bg-amber-50/40 p-2.5 dark:border-amber-900/35 dark:bg-amber-950/20 sm:bg-muted/30 sm:p-4">
            <Label className="text-xs sm:text-sm">Yeni kat planı</Label>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Input
                placeholder="Etiket (örn. Zemin)"
                value={newPlanLabel}
                onChange={(e) => setNewPlanLabel(e.target.value)}
                className="h-9 w-full text-xs sm:w-36 sm:text-sm"
              />
              <Input
                placeholder="https://… plan görseli"
                value={newPlanUrl}
                onChange={(e) => setNewPlanUrl(e.target.value)}
                className="h-9 min-w-0 flex-1 text-xs sm:text-sm"
              />
              <Button className="h-9 w-full shrink-0 sm:w-auto" onClick={handleAddPlan} disabled={savingUrl || !newPlanUrl.trim()}>
                {savingUrl ? <LoadingSpinner className="size-4" /> : <Plus className="size-4" />}
                Ekle
              </Button>
            </div>
          </div>
        )}

        {floorPlans.length === 0 ? (
          <div className="flex min-h-[180px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-amber-300/50 bg-linear-to-b from-amber-50/80 to-muted/20 p-4 dark:border-amber-800/40 dark:from-amber-950/30 sm:min-h-[240px] sm:p-8">
            <MapPin className="mb-1.5 size-9 text-amber-600/70 sm:mb-2 sm:size-12 sm:text-muted-foreground" />
            <p className="px-2 text-center text-[11px] leading-snug text-muted-foreground sm:text-sm">
              {canManage
                ? "Kat planı ekleyin. Etiket ve görsel URL'si girip Ekle'ye basın."
                : 'Henüz kat planı eklenmemiş.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            {floorPlans.map((plan, floorIndex) => (
              <div
                key={floorIndex}
                className="rounded-lg border border-amber-200/30 bg-card p-2.5 dark:border-amber-900/25 sm:border-border sm:p-4"
                ref={(el) => { containerRefs.current.set(floorIndex, el); }}
              >
                <div className="mb-2 flex items-center justify-between gap-2 sm:mb-3">
                  <h3 className="truncate text-sm font-medium sm:text-base">{plan.label}</h3>
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleRemovePlan(floorIndex)}
                    >
                      <Trash2 className="mr-1 size-4" />
                      Sil
                    </Button>
                  )}
                </div>
                <div
                  className="relative h-[min(42vh,300px)] w-full max-h-[min(55vh,420px)] overflow-auto rounded-lg border bg-muted/50 sm:h-[min(48vh,380px)]"
                  onMouseMove={(e) => {
                    if (draggingId && containerRefs.current.get(floorIndex)) {
                      const container = containerRefs.current.get(floorIndex);
                      if (!container) return;
                      const rect = container.getBoundingClientRect();
                      let x = ((e.clientX - rect.left) / rect.width) * 100;
                      let y = ((e.clientY - rect.top) / rect.height) * 100;
                      x = Math.max(0, Math.min(100, x));
                      y = Math.max(0, Math.min(100, y));
                      lastPosRef.current = { x, y };
                      setDropPosition({ x, y });
                    }
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={plan.url}
                    alt={plan.label}
                    className="absolute inset-0 h-full w-full object-contain"
                    draggable={false}
                    onError={() => toast.error(`${plan.label} görseli yüklenemedi.`)}
                  />
                  {getDevicesForFloor(floorIndex).map((d) => {
                    const x = d.planPositionX ?? 10;
                    const y = d.planPositionY ?? 10;
                    const isDragging = draggingId === d.id;
                    const status = getDeviceStatus(d, activeDeviceIds);
                    const cfg = STATUS_CONFIG[status];
                    const StatusIcon = cfg.icon;
                    return (
                      <div
                        key={d.id}
                        className={`absolute flex max-w-[min(26vw,5.25rem)] -translate-x-1/2 -translate-y-1/2 cursor-grab flex-col items-center rounded-md border px-1 py-0.5 text-[0.62rem] font-medium leading-tight shadow-sm transition-shadow [transform-origin:center] active:cursor-grabbing sm:max-w-[6.5rem] sm:rounded-lg sm:border-2 sm:px-1.5 sm:py-1 sm:text-xs sm:shadow-md ${cfg.bg} ${cfg.border} ${cfg.text} ${
                          isDragging ? 'z-10 scale-110 shadow-lg' : 'hover:shadow-md sm:hover:shadow-lg'
                        }`}
                        style={{
                          left: `${isDragging && dropPosition ? dropPosition.x : x}%`,
                          top: `${isDragging && dropPosition ? dropPosition.y : y}%`,
                        }}
                        onMouseDown={(e) => handleMarkerMouseDown(e, d, floorIndex)}
                        title={`${d.name}${d.classSection ? ` • ${d.classSection}` : ''} – Tahta ${cfg.label}`}
                      >
                        <span className="flex items-center gap-0.5">
                          <Monitor className="size-2.5 sm:size-3.5" aria-hidden />
                          <StatusIcon className="size-2 sm:size-3" aria-hidden />
                        </span>
                        <span className="line-clamp-2 max-w-full text-center font-medium">{d.name}</span>
                        {d.classSection && (
                          <span className="line-clamp-1 max-w-full text-[0.55rem] opacity-90 sm:text-[10px]">{d.classSection}</span>
                        )}
                        <span className="text-[0.55rem] opacity-80 sm:text-[10px]">{cfg.label}</span>
                        {canManage && floorPlans.length > 1 && onAssignDeviceToFloor && (
                          <div className="mt-0.5 w-full min-w-0" onClick={(e) => e.stopPropagation()}>
                            <Select
                              value={String(d.planFloorIndex ?? 0)}
                              onValueChange={(v) => onAssignDeviceToFloor(d.id, Number(v))}
                            >
                              <SelectTrigger className="h-4 w-full min-w-0 border-0 bg-white/20 px-0.5 text-[0.55rem] sm:h-5 sm:px-1 sm:text-[10px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {floorPlans.map((fp, i) => (
                                  <SelectItem key={i} value={String(i)}>
                                    {fp.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {getDevicesForFloor(floorIndex).length === 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Bu katta tahta yok. Cihazlar sekmesinden tahtaya kat atamak için sürükleyin veya cihazı düzenleyin.
                  </p>
                )}
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-muted/30 px-4 py-2 text-xs">
              <span className="font-medium text-muted-foreground">Durum:</span>
              <span className="flex items-center gap-1.5">
                <span className="inline-flex h-5 items-center gap-1 rounded border-2 border-emerald-400 bg-emerald-600 px-1.5 text-white">
                  <LockOpen className="size-3" /> Açık
                </span>
                <span className="text-muted-foreground">çevrimiçi, kullanılabilir</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-flex h-5 items-center gap-1 rounded border-2 border-amber-400 bg-amber-600 px-1.5 text-white">
                  <Lock className="size-3" /> Kilitli
                </span>
                <span className="text-muted-foreground">öğretmen bağlı</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-flex h-5 items-center gap-1 rounded border-2 border-slate-400 bg-slate-500 px-1.5 text-white">
                  <PowerOff className="size-3" /> Kapalı
                </span>
                <span className="text-muted-foreground">çevrimdışı</span>
              </span>
            </div>
          </div>
        )}

        {devices.length === 0 && (
          <Alert variant="info">
            Yerleştirilecek tahta yok. Önce Cihazlar sekmesinden tahta ekleyin.
          </Alert>
        )}

        {devices.length > 0 && floorPlans.length === 0 && canManage && (
          <Alert variant="info">
            Tahtaları yerleştirmek için yukarıya kat planı ekleyin.
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
