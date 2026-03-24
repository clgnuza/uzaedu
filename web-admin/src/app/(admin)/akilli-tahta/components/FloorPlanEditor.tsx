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
    <Card className="border-border/80">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="size-5" />
          Kroki Planları – Tahta Yerleşimi
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Birden fazla kat planı ekleyebilirsiniz. Her planda tahtaları sürükleyerek konumlandırın.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {canManage && (
          <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
            <Label>Yeni kat planı ekle</Label>
            <div className="flex flex-wrap gap-2">
              <Input
                placeholder="Etiket (örn. Zemin Kat)"
                value={newPlanLabel}
                onChange={(e) => setNewPlanLabel(e.target.value)}
                className="w-36"
              />
              <Input
                placeholder="https://example.com/kat-plani.png"
                value={newPlanUrl}
                onChange={(e) => setNewPlanUrl(e.target.value)}
                className="min-w-[220px] flex-1"
              />
              <Button onClick={handleAddPlan} disabled={savingUrl || !newPlanUrl.trim()}>
                {savingUrl ? <LoadingSpinner className="size-4" /> : <Plus className="size-4" />}
                Ekle
              </Button>
            </div>
          </div>
        )}

        {floorPlans.length === 0 ? (
          <div className="flex min-h-[240px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/30 p-8">
            <MapPin className="mb-2 size-12 text-muted-foreground" />
            <p className="text-center text-sm text-muted-foreground">
              {canManage
                ? "Kat planı ekleyin. Etiket ve görsel URL'si girip Ekle'ye basın."
                : 'Henüz kat planı eklenmemiş.'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {floorPlans.map((plan, floorIndex) => (
              <div
                key={floorIndex}
                className="rounded-lg border bg-card p-4"
                ref={(el) => { containerRefs.current.set(floorIndex, el); }}
              >
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-medium">{plan.label}</h3>
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
                  className="relative aspect-video w-full overflow-hidden rounded-lg border bg-muted/50"
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
                        className={`absolute flex -translate-x-1/2 -translate-y-1/2 cursor-grab flex-col items-center rounded-lg border-2 px-2 py-1 text-xs font-medium shadow-md transition-shadow active:cursor-grabbing ${cfg.bg} ${cfg.border} ${cfg.text} ${
                          isDragging ? 'z-10 scale-110 shadow-lg' : 'hover:shadow-lg'
                        }`}
                        style={{
                          left: `${isDragging && dropPosition ? dropPosition.x : x}%`,
                          top: `${isDragging && dropPosition ? dropPosition.y : y}%`,
                        }}
                        onMouseDown={(e) => handleMarkerMouseDown(e, d, floorIndex)}
                        title={`${d.name}${d.classSection ? ` • ${d.classSection}` : ''} – Tahta ${cfg.label}`}
                      >
                        <span className="flex items-center gap-1">
                          <Monitor className="size-3.5" aria-hidden />
                          <StatusIcon className="size-3" aria-hidden />
                        </span>
                        <span className="font-medium">{d.name}</span>
                        {d.classSection && (
                          <span className="text-[10px] opacity-90">{d.classSection}</span>
                        )}
                        <span className="text-[10px] opacity-80">{cfg.label}</span>
                        {canManage && floorPlans.length > 1 && onAssignDeviceToFloor && (
                          <div className="mt-0.5" onClick={(e) => e.stopPropagation()}>
                            <Select
                              value={String(d.planFloorIndex ?? 0)}
                              onValueChange={(v) => onAssignDeviceToFloor(d.id, Number(v))}
                            >
                              <SelectTrigger className="h-5 w-full min-w-0 border-0 bg-white/20 px-1 text-[10px]">
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
