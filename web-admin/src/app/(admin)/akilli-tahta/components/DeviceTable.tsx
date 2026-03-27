'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { LockOpen, Lock, XCircle, Trash2, Copy, Calendar, User, RotateCw, PowerOff, Monitor } from 'lucide-react';
import { toast } from 'sonner';
import type { Device, Session } from '../types';

/** Cihaz durumu: Açık (çevrimiçi, kullanılabilir), Kilitli (öğretmen bağlı), Kapalı (çevrimdışı) */
type DeviceDisplayStatus = 'open' | 'locked' | 'closed';

function getDeviceStatus(device: Device, activeDeviceIds: Set<string>): DeviceDisplayStatus {
  if (device.status !== 'online') return 'closed';
  if (activeDeviceIds.has(device.id)) return 'locked';
  return 'open';
}

const STATUS_CONFIG: Record<
  DeviceDisplayStatus,
  { label: string; shortLabel: string; icon: typeof LockOpen; className: string }
> = {
  open: {
    label: 'Tahta Açık',
    shortLabel: 'Açık',
    icon: LockOpen,
    className: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-600',
  },
  locked: {
    label: 'Tahta Kilitli',
    shortLabel: 'Kilitli',
    icon: Lock,
    className: 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-600',
  },
  closed: {
    label: 'Tahta Kapalı',
    shortLabel: 'Kapalı',
    icon: PowerOff,
    className: 'bg-slate-500/20 text-slate-700 dark:text-slate-400 border-slate-300 dark:border-slate-600',
  },
};

function StatusBadge({ status }: { status: DeviceDisplayStatus }) {
  const c = STATUS_CONFIG[status];
  const Icon = c.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-xs font-semibold ${c.className}`}
      title={c.label}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {c.label}
    </span>
  );
}

function formatLastSeen(iso: string | null): string {
  if (!iso) return 'Hiç görülmedi';
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 2) return 'Şimdi';
    if (diffMin < 60) return `${diffMin} dk önce`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH} sa önce`;
    return d.toLocaleString('tr-TR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

function formatConnectedAgo(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
    if (diffMin < 1) return 'az önce';
    if (diffMin < 60) return `${diffMin} dk önce bağlandı`;
    return `${Math.floor(diffMin / 60)} sa önce bağlandı`;
  } catch {
    return '';
  }
}

export function DeviceTable({
  devices,
  sessions,
  schoolId,
  readOnly,
  canManage,
  onEdit,
  onDelete,
  onBulkDelete,
  onCopyPairingCode,
  onSchedule,
  onDisconnect,
  onClose,
  onRefresh,
}: {
  devices: Device[];
  sessions: Session[];
  schoolId?: string | null;
  readOnly?: boolean;
  canManage?: boolean;
  onEdit: (d: Device) => void;
  onDelete: (d: Device) => void;
  onBulkDelete: (devices: Device[]) => void;
  onCopyPairingCode: (code: string) => void;
  onSchedule?: (d: Device) => void;
  onDisconnect?: (sessionId: string) => void;
  onClose?: (device: Device | Device[]) => void;
  onRefresh?: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const activeDeviceIds = new Set(
    sessions.filter((s) => s.is_active).map((s) => s.device_id)
  );

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === devices.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(devices.map((d) => d.id)));
    }
  };

  const selectedDevices = devices.filter((d) => selected.has(d.id));

  const handleBulkDelete = () => {
    if (selectedDevices.length === 0) return;
    onBulkDelete(selectedDevices);
    setSelected(new Set());
  };

  const handleBulkAction = (action: 'open' | 'lock' | 'close') => {
    if (selectedDevices.length === 0) return;
    if (action === 'lock') {
      const withSession = selectedDevices.filter((d) => activeDeviceIds.has(d.id));
      if (withSession.length > 0 && onDisconnect) {
        const sess = sessions.find((s) => s.is_active && s.device_id === withSession[0].id);
        if (sess) onDisconnect(sess.id);
        toast.info('Bağlantı sonlandırıldı. Toplu kilitle tam desteği planlanıyor.');
      } else {
        toast.info('Toplu kilitle özelliği planlanıyor.');
      }
    } else if (action === 'close' && onClose) {
      onClose(selectedDevices);
    } else if (action === 'close') {
      toast.info('Toplu Aç/Kapat özelliği planlanıyor.');
    } else {
      toast.info('Toplu Aç özelliği planlanıyor.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Tüm Sınıflar</h2>
          {selectedDevices.length > 0 && (
            <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-sm font-medium text-primary">
              {selectedDevices.length} seçili
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onRefresh && (
            <Button variant="outline" size="sm" onClick={onRefresh} title="Listeyi yenile">
              <RotateCw className="mr-1.5 size-4" />
              Yenile
            </Button>
          )}
          {canManage && devices.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
              disabled={selectedDevices.length === 0}
            >
              <Trash2 className="mr-2 size-4" />
              Toplu Sil
            </Button>
            <Button
              variant="default"
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => handleBulkAction('open')}
              disabled={selectedDevices.length === 0}
            >
              <LockOpen className="mr-2 size-4" />
              Toplu Aç
            </Button>
            <Button
              variant="default"
              size="sm"
              className="bg-primary"
              onClick={() => handleBulkAction('lock')}
              disabled={selectedDevices.length === 0}
            >
              <Lock className="mr-2 size-4" />
              Toplu Kilitle
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleBulkAction('close')}
              disabled={selectedDevices.length === 0}
            >
              <XCircle className="mr-2 size-4" />
              Toplu Kapat
            </Button>
          </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-muted/30 px-4 py-2 text-xs">
        <span className="font-medium text-muted-foreground">Durum:</span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-emerald-500" aria-hidden />
          <LockOpen className="size-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Açık</span>
          <span className="text-muted-foreground">— çevrimiçi, kullanılabilir</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-amber-500" aria-hidden />
          <Lock className="size-3.5 text-amber-600 dark:text-amber-400" />
          <span>Kilitli</span>
          <span className="text-muted-foreground">— öğretmen bağlı</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-slate-400" aria-hidden />
          <PowerOff className="size-3.5 text-slate-500 dark:text-slate-400" />
          <span>Kapalı</span>
          <span className="text-muted-foreground">— çevrimdışı</span>
        </span>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {canManage && (
                <TableHead className="w-10 px-2">
                  <input
                    type="checkbox"
                    checked={devices.length > 0 && selected.size === devices.length}
                    onChange={toggleSelectAll}
                    className="size-4 rounded border-input"
                    aria-label="Tümünü seç"
                  />
                </TableHead>
              )}
              <TableHead>Sınıf Adı</TableHead>
              <TableHead>Bağlı öğretmen</TableHead>
              <TableHead title="Ders programındaki slot (ders saati, ders, öğretmen)">
                Şu an
              </TableHead>
              <TableHead>Durum</TableHead>
              <TableHead>Tahta İşlemleri</TableHead>
              {canManage && <TableHead className="w-24" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {devices.map((d) => {
              const displayStatus = getDeviceStatus(d, activeDeviceIds);
              const session = sessions.find((s) => s.device_id === d.id && s.is_active);
              return (
                <TableRow key={d.id}>
                  {canManage && (
                    <TableCell className="px-2">
                      <input
                        type="checkbox"
                        checked={selected.has(d.id)}
                        onChange={() => toggleSelect(d.id)}
                        className="size-4 rounded border-input"
                        aria-label={`${d.name} seç`}
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`mt-0.5 shrink-0 size-2.5 rounded-full border-2 ${
                            displayStatus === 'open'
                              ? 'bg-emerald-500 border-emerald-400'
                              : displayStatus === 'locked'
                                ? 'bg-amber-500 border-amber-400'
                                : 'bg-slate-400 border-slate-300'
                          }`}
                          title={STATUS_CONFIG[displayStatus].label}
                          aria-hidden
                        />
                        {readOnly ? (
                          <span className="font-medium">{d.name}</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onEdit(d)}
                            className="font-medium text-primary hover:underline text-left"
                          >
                            {d.name}
                          </button>
                        )}
                        {d.classSection && (
                          <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            {d.classSection}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatLastSeen(d.last_seen_at ?? null)}
                      </span>
                      {d.roomOrLocation && (
                        <span className="text-xs text-muted-foreground"> • {d.roomOrLocation}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {session ? (
                      <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/80 dark:border-amber-800 dark:bg-amber-950/30 px-3 py-2">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50">
                          <User className="size-4.5 text-amber-700 dark:text-amber-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-amber-900 dark:text-amber-100 truncate">
                            {session.user_name || 'Öğretmen'}
                          </p>
                          <p className="text-xs text-amber-700/80 dark:text-amber-400/80">
                            {formatConnectedAgo(session.connected_at)}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {d.current_slot ? (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm">
                        <span className="font-medium text-primary">
                          {d.current_slot.lesson_num}. Ders
                        </span>
                        <span className="text-muted-foreground">{d.current_slot.subject}</span>
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <User className="size-3.5" />
                          {d.current_slot.teacher_name}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={displayStatus} />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                        onClick={() => toast.info('Toplu Aç özelliği planlanıyor.')}
                        title="Aç"
                      >
                        <LockOpen className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-primary hover:bg-primary/10"
                        onClick={() => {
                          if (session && onDisconnect) {
                            onDisconnect(session.id);
                          } else {
                            toast.info('Kilitle özelliği planlanıyor.');
                          }
                        }}
                        title="Kilitle / Bağlantıyı Kes"
                      >
                        <Lock className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-muted-foreground hover:bg-muted"
                        onClick={() => onClose ? onClose(d) : toast.info('Kapat özelliği planlanıyor.')}
                        title="Kapat"
                      >
                        <XCircle className="size-4" />
                      </Button>
                      {onSchedule && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8"
                          onClick={() => onSchedule(d)}
                          title="Program"
                        >
                          <Calendar className="size-4" />
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 font-mono text-xs"
                        onClick={() => onCopyPairingCode(d.pairing_code)}
                        title="Eşleme kodu"
                      >
                        <Copy className="mr-1 size-3" />
                        {d.pairing_code}
                      </Button>
                      {schoolId && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1 border-sky-300/80 text-xs text-sky-800 hover:bg-sky-50 dark:border-sky-700 dark:text-sky-200 dark:hover:bg-sky-950/50"
                          onClick={() => {
                            const base = typeof window !== 'undefined' ? window.location.origin : '';
                            const url = `${base}/tv/classroom?school_id=${encodeURIComponent(schoolId)}&device_id=${encodeURIComponent(d.id)}`;
                            void navigator.clipboard.writeText(url).then(() =>
                              toast.success('Duyuru TV adresi kopyalandı — tahta tarayıcısına yapıştırın'),
                            );
                          }}
                          title="Bu sınıfa özel /tv/classroom adresini kopyala (uzun URL yazmaya gerek yok)"
                        >
                          <Monitor className="size-3.5 shrink-0" />
                          <span className="hidden sm:inline">Duyuru TV</span>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-destructive hover:bg-destructive/10"
                        onClick={() => onDelete(d)}
                      >
                        <Trash2 className="mr-1 size-4" />
                        Sınıfı Sil
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
