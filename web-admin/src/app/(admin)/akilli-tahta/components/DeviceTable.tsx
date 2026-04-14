'use client';

import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  LockOpen,
  Lock,
  XCircle,
  Trash2,
  Copy,
  Calendar,
  User,
  RotateCw,
  PowerOff,
  Monitor,
  Clock,
  MapPin,
  BookOpen,
  KeyRound,
  Link2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Device, Session } from '../types';

/** Cihaz durumu: Açık (çevrimiçi, kullanılabilir), Kilitli (öğretmen bağlı), Kapalı (çevrimdışı) */
type DeviceDisplayStatus = 'open' | 'locked' | 'closed';

type SortKey = 'name' | 'class' | 'status' | 'seen';

function getDeviceStatus(device: Device, activeDeviceIds: Set<string>): DeviceDisplayStatus {
  if (device.status !== 'online') return 'closed';
  if (activeDeviceIds.has(device.id)) return 'locked';
  return 'open';
}

function statusRank(device: Device, activeDeviceIds: Set<string>): number {
  const st = getDeviceStatus(device, activeDeviceIds);
  if (st === 'open') return 0;
  if (st === 'locked') return 1;
  return 2;
}

function sortDevices(
  list: Device[],
  sessions: Session[],
  key: SortKey,
  dir: number,
  activeDeviceIds: Set<string>,
): Device[] {
  const seenTs = (d: Device) => (d.last_seen_at ? new Date(d.last_seen_at).getTime() : 0);
  return [...list].sort((a, b) => {
    let cmp = 0;
    if (key === 'name') cmp = (a.name ?? '').localeCompare(b.name ?? '', 'tr');
    else if (key === 'class')
      cmp =
        (a.classSection ?? '').localeCompare(b.classSection ?? '', 'tr') ||
        (a.name ?? '').localeCompare(b.name ?? '', 'tr');
    else if (key === 'status') cmp = statusRank(a, activeDeviceIds) - statusRank(b, activeDeviceIds);
    else if (key === 'seen') cmp = seenTs(a) - seenTs(b);
    return cmp * dir;
  });
}

const STATUS_CONFIG: Record<
  DeviceDisplayStatus,
  { label: string; shortLabel: string; icon: typeof LockOpen; className: string }
> = {
  open: {
    label: 'Tahta açık',
    shortLabel: 'Açık',
    icon: LockOpen,
    className: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-600',
  },
  locked: {
    label: 'Tahta kilitli (öğretmen bağlı)',
    shortLabel: 'Kilitli',
    icon: Lock,
    className: 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-600',
  },
  closed: {
    label: 'Tahta kapalı',
    shortLabel: 'Kapalı',
    icon: PowerOff,
    className: 'bg-slate-500/20 text-slate-700 dark:text-slate-400 border-slate-300 dark:border-slate-600',
  },
};

const SORT_LABELS: Record<SortKey, string> = {
  name: 'Ad',
  class: 'Sınıf',
  status: 'Durum',
  seen: 'Son sinyal',
};

function StatusBadge({ status, emphasized }: { status: DeviceDisplayStatus; emphasized?: boolean }) {
  const c = STATUS_CONFIG[status];
  const Icon = c.icon;
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-full border-2 font-semibold',
        emphasized ? 'px-3 py-1.5 text-xs sm:text-sm' : 'px-2 py-0.5 text-[10px] sm:gap-1.5 sm:px-3 sm:py-1 sm:text-xs',
        c.className,
      )}
      title={c.label}
    >
      <Icon className={cn('shrink-0', emphasized ? 'size-4' : 'size-3 sm:size-3.5')} aria-hidden />
      <span className={cn('min-w-0', emphasized ? '' : 'truncate sm:hidden')}>{emphasized ? c.label : c.shortLabel}</span>
      {!emphasized ? <span className="hidden min-w-0 sm:inline">{c.label}</span> : null}
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
    if (diffH < 24) return `${diffH} saat önce`;
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
    if (diffMin < 1) return 'Az önce bağlandı';
    if (diffMin < 60) return `${diffMin} dk önce bağlandı`;
    return `${Math.floor(diffMin / 60)} saat önce bağlandı`;
  } catch {
    return '';
  }
}

function InfoCard({
  label,
  icon: Icon,
  accent,
  children,
  className,
}: {
  label: string;
  icon: typeof Clock;
  accent: 'slate' | 'cyan' | 'violet' | 'amber' | 'emerald';
  children: ReactNode;
  className?: string;
}) {
  const ring =
    accent === 'cyan'
      ? 'border-cyan-500/20 bg-linear-to-br from-cyan-500/8 via-card to-sky-500/5'
      : accent === 'violet'
        ? 'border-violet-500/20 bg-linear-to-br from-violet-500/8 via-card to-fuchsia-500/5'
        : accent === 'amber'
          ? 'border-amber-500/25 bg-linear-to-br from-amber-500/10 via-card to-orange-500/5'
          : accent === 'emerald'
            ? 'border-emerald-500/20 bg-linear-to-br from-emerald-500/8 via-card to-teal-500/5'
            : 'border-border/70 bg-card/80';
  const iconWrap =
    accent === 'cyan'
      ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300'
      : accent === 'violet'
        ? 'bg-violet-500/15 text-violet-700 dark:text-violet-300'
        : accent === 'amber'
          ? 'bg-amber-500/15 text-amber-800 dark:text-amber-200'
          : accent === 'emerald'
            ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200'
            : 'bg-muted text-muted-foreground';
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border p-3.5 shadow-sm sm:p-4',
        ring,
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-xl ring-1 ring-black/5 dark:ring-white/10', iconWrap)}>
          <Icon className="size-4" aria-hidden />
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <div className="mt-3 min-w-0">{children}</div>
    </div>
  );
}

function DeviceDetailCards({
  d,
  displayStatus,
  session,
  schoolId,
  onCopyPairingCode,
}: {
  d: Device;
  displayStatus: DeviceDisplayStatus;
  session: Session | undefined;
  schoolId?: string | null;
  onCopyPairingCode: (code: string) => void;
}) {
  const copyTvUrl = () => {
    if (!schoolId) return;
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    const url = `${base}/tv/classroom?school_id=${encodeURIComponent(schoolId)}&device_id=${encodeURIComponent(d.id)}`;
    void navigator.clipboard.writeText(url).then(() => toast.success('Duyuru TV adresi kopyalandı'));
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <InfoCard label="Durum ve sinyal" icon={Monitor} accent="emerald" className="sm:col-span-2 xl:col-span-1">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <StatusBadge status={displayStatus} emphasized />
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <Clock className="mt-0.5 size-4 shrink-0 text-emerald-600/80 dark:text-emerald-400/80" />
              <div>
                <p className="font-medium text-foreground">Son görülme</p>
                <p>{formatLastSeen(d.last_seen_at ?? null)}</p>
              </div>
            </div>
          </div>
        </InfoCard>

        <InfoCard label="Sınıf ve konum" icon={MapPin} accent="cyan">
          <div className="space-y-1.5 text-sm">
            <p>
              <span className="text-muted-foreground">Sınıf</span>{' '}
              <span className="font-semibold text-foreground">{d.classSection?.trim() || '—'}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Oda / konum</span>{' '}
              <span className="font-medium text-foreground">{d.roomOrLocation?.trim() || '—'}</span>
            </p>
          </div>
        </InfoCard>

        <InfoCard label="Bağlantı" icon={User} accent="amber">
          {session ? (
            <div className="space-y-1">
              <p className="text-base font-semibold text-foreground">{session.user_name || 'Öğretmen'}</p>
              <p className="text-xs text-amber-800/90 dark:text-amber-200/90">{formatConnectedAgo(session.connected_at)}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Şu an öğretmen bağlı değil.</p>
          )}
        </InfoCard>

        <InfoCard label="Ders programı" icon={BookOpen} accent="violet" className="sm:col-span-2 xl:col-span-1">
          {d.current_slot ? (
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
              <span className="rounded-lg bg-violet-500/15 px-2 py-0.5 text-sm font-bold text-violet-900 dark:text-violet-100">
                {d.current_slot.lesson_num}. ders
              </span>
              <span className="font-medium text-foreground">{d.current_slot.subject}</span>
              <span className="flex items-center gap-1 text-muted-foreground">
                <User className="size-3.5 shrink-0 opacity-70" />
                {d.current_slot.teacher_name}
              </span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Bu slotta program kaydı yok.</p>
          )}
        </InfoCard>

        <InfoCard label="Eşleme ve TV" icon={KeyRound} accent="slate" className="sm:col-span-2 xl:col-span-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Eşleme kodu</p>
              <p className="mt-1 font-mono text-lg font-semibold tracking-wide text-foreground">{d.pairing_code}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" size="sm" className="h-9 gap-1.5 rounded-xl" onClick={() => onCopyPairingCode(d.pairing_code)}>
                <Copy className="size-3.5" />
                Kodu kopyala
              </Button>
              {schoolId ? (
                <Button type="button" variant="outline" size="sm" className="h-9 gap-1.5 rounded-xl border-cyan-500/30" onClick={copyTvUrl}>
                  <Link2 className="size-3.5" />
                  Duyuru TV URL
                </Button>
              ) : null}
            </div>
          </div>
        </InfoCard>
      </div>
    </div>
  );
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
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const activeDeviceIds = useMemo(
    () => new Set(sessions.filter((s) => s.is_active).map((s) => s.device_id)),
    [sessions],
  );

  const sortedDevices = useMemo(
    () => sortDevices(devices, sessions, sortKey, sortDir, activeDeviceIds),
    [devices, sessions, sortKey, sortDir, activeDeviceIds],
  );

  const colCount = canManage ? 7 : 5;

  const setSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => -d);
    else {
      setSortKey(key);
      setSortDir(key === 'seen' ? -1 : 1);
    }
  };

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
      toast.info('Toplu aç/kapat özelliği planlanıyor.');
    } else {
      toast.info('Toplu aç özelliği planlanıyor.');
    }
  };

  return (
    <div className="space-y-2 sm:space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className="text-xs font-semibold sm:text-lg">Tüm sınıflar</h2>
          {selectedDevices.length > 0 && (
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary sm:text-sm">
              {selectedDevices.length} seçili
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {onRefresh && (
            <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-[10px] sm:h-9 sm:px-3 sm:text-sm" onClick={onRefresh} title="Listeyi yenile">
              <RotateCw className="size-3 sm:mr-1 sm:size-4" />
              Yenile
            </Button>
          )}
          {canManage && devices.length > 0 && (
            <div className="flex w-full flex-wrap gap-1 sm:w-auto sm:gap-2">
              <Button
                variant="destructive"
                size="sm"
                className="h-7 flex-1 px-2 text-[10px] sm:h-9 sm:flex-none sm:text-sm"
                onClick={handleBulkDelete}
                disabled={selectedDevices.length === 0}
              >
                <Trash2 className="mr-1 size-3 sm:size-4" />
                Sil
              </Button>
              <Button
                variant="default"
                size="sm"
                className="h-7 flex-1 bg-emerald-600 px-2 text-[10px] hover:bg-emerald-700 sm:h-9 sm:flex-none sm:text-sm"
                onClick={() => handleBulkAction('open')}
                disabled={selectedDevices.length === 0}
              >
                <LockOpen className="mr-1 size-3 sm:size-4" />
                Aç
              </Button>
              <Button
                variant="default"
                size="sm"
                className="h-7 flex-1 px-2 text-[10px] sm:h-9 sm:flex-none sm:text-sm"
                onClick={() => handleBulkAction('lock')}
                disabled={selectedDevices.length === 0}
              >
                <Lock className="mr-1 size-3 sm:size-4" />
                Kilitle
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="h-7 flex-1 px-2 text-[10px] sm:h-9 sm:flex-none sm:text-sm"
                onClick={() => handleBulkAction('close')}
                disabled={selectedDevices.length === 0}
              >
                <XCircle className="mr-1 size-3 sm:size-4" />
                Kapat
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border/60 bg-muted/20 px-2 py-1.5">
        <span className="w-full text-[10px] font-medium text-muted-foreground sm:w-auto sm:text-xs">Sırala:</span>
        {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
          <Button
            key={key}
            type="button"
            variant={sortKey === key ? 'secondary' : 'ghost'}
            size="sm"
            className={cn('h-7 px-2 text-[10px] sm:h-8 sm:text-xs', sortKey === key && 'ring-1 ring-border')}
            onClick={() => setSort(key)}
          >
            {SORT_LABELS[key]}
            {sortKey === key ? <span className="ml-0.5 tabular-nums opacity-70">{sortDir === 1 ? '↑' : '↓'}</span> : null}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border bg-muted/30 px-2 py-1.5 text-[10px] sm:gap-x-4 sm:px-3 sm:py-2 sm:text-xs">
        <span className="w-full shrink-0 font-semibold text-muted-foreground sm:w-auto sm:font-medium">Durum</span>
        <span className="inline-flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-emerald-500 sm:size-2" aria-hidden />
          <LockOpen className="size-3 text-emerald-600 dark:text-emerald-400" />
          <span>Açık</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-amber-500 sm:size-2" aria-hidden />
          <Lock className="size-3 text-amber-600 dark:text-amber-400" />
          <span>Kilitli</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-slate-400 sm:size-2" aria-hidden />
          <PowerOff className="size-3 text-slate-500 dark:text-slate-400" />
          <span>Kapalı</span>
        </span>
      </div>

      <div className="space-y-2 md:hidden">
        {sortedDevices.map((d) => {
          const displayStatus = getDeviceStatus(d, activeDeviceIds);
          const session = sessions.find((s) => s.device_id === d.id && s.is_active);
          const open = expandedId === d.id;
          return (
            <div key={d.id} className="overflow-hidden rounded-lg border border-border/80 bg-card shadow-sm">
              <button
                type="button"
                className="flex w-full items-start gap-2 p-2.5 text-left"
                onClick={() => setExpandedId(open ? null : d.id)}
              >
                <span
                  className={cn(
                    'mt-1 size-2 shrink-0 rounded-full border-2',
                    displayStatus === 'open' && 'border-emerald-400 bg-emerald-500',
                    displayStatus === 'locked' && 'border-amber-400 bg-amber-500',
                    displayStatus === 'closed' && 'border-slate-300 bg-slate-400',
                  )}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold leading-tight">{d.name}</span>
                    {d.classSection ? (
                      <span className="rounded bg-primary/10 px-1.5 py-px text-[10px] font-medium text-primary">{d.classSection}</span>
                    ) : null}
                  </div>
                  <div className="mt-1">
                    <StatusBadge status={displayStatus} />
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">{formatLastSeen(d.last_seen_at ?? null)}</p>
                </div>
              </button>
              {open ? (
                <div className="border-t border-border/60 bg-muted/20 px-3 py-3 sm:px-4">
                  <DeviceDetailCards
                    d={d}
                    displayStatus={displayStatus}
                    session={session}
                    schoolId={schoolId}
                    onCopyPairingCode={onCopyPairingCode}
                  />
                  <div className="mt-3 flex flex-wrap gap-1 border-t border-border/40 pt-2">
                    {!readOnly && (
                      <Button variant="outline" size="sm" className="h-8 text-[10px]" onClick={() => onEdit(d)}>
                        Düzenle
                      </Button>
                    )}
                    {onSchedule && (
                      <Button variant="outline" size="sm" className="h-8 text-[10px]" onClick={() => onSchedule(d)}>
                        <Calendar className="mr-1 size-3" />
                        Program
                      </Button>
                    )}
                    <Button variant="outline" size="sm" className="h-8 font-mono text-[10px]" onClick={() => onCopyPairingCode(d.pairing_code)}>
                      <Copy className="mr-1 size-3" />
                      {d.pairing_code}
                    </Button>
                    {schoolId && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-[10px]"
                        onClick={() => {
                          const base = typeof window !== 'undefined' ? window.location.origin : '';
                          const url = `${base}/tv/classroom?school_id=${encodeURIComponent(schoolId)}&device_id=${encodeURIComponent(d.id)}`;
                          void navigator.clipboard.writeText(url).then(() => toast.success('Duyuru TV adresi kopyalandı'));
                        }}
                      >
                        <Monitor className="mr-1 size-3" />
                        TV URL
                      </Button>
                    )}
                    {session && onDisconnect && (
                      <Button variant="outline" size="sm" className="h-8 text-[10px] text-amber-700" onClick={() => onDisconnect(session.id)}>
                        Bağlantıyı kes
                      </Button>
                    )}
                    {canManage && (
                      <Button variant="ghost" size="sm" className="h-8 text-destructive text-[10px]" onClick={() => onDelete(d)}>
                        Sil
                      </Button>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="-mx-1 hidden overflow-x-auto overscroll-x-contain rounded-lg border touch-pan-x md:mx-0 md:block">
        <Table className="min-w-136">
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
              <TableHead className="cursor-pointer select-none" onClick={() => setSort('name')} title="Sırala">
                Sınıf / tahta
                {sortKey === 'name' ? (sortDir === 1 ? ' ↑' : ' ↓') : ''}
              </TableHead>
              <TableHead>Bağlı öğretmen</TableHead>
              <TableHead title="Ders programındaki slot">Şu an</TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => setSort('status')} title="Sırala">
                Durum
                {sortKey === 'status' ? (sortDir === 1 ? ' ↑' : ' ↓') : ''}
              </TableHead>
              <TableHead>Tahta işlemleri</TableHead>
              {canManage && <TableHead className="w-24" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedDevices.map((d) => {
              const displayStatus = getDeviceStatus(d, activeDeviceIds);
              const session = sessions.find((s) => s.device_id === d.id && s.is_active);
              return (
                <Fragment key={d.id}>
                  <TableRow
                    className={cn(expandedId === d.id && 'bg-muted/35')}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('button, a, input, [role="combobox"]')) return;
                      setExpandedId(expandedId === d.id ? null : d.id);
                    }}
                  >
                    {canManage && (
                      <TableCell className="px-2">
                        <input
                          type="checkbox"
                          checked={selected.has(d.id)}
                          onChange={() => toggleSelect(d.id)}
                          className="size-4 rounded border-input"
                          aria-label={`${d.name} seç`}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'mt-0.5 size-2.5 shrink-0 rounded-full border-2',
                              displayStatus === 'open' && 'bg-emerald-500 border-emerald-400',
                              displayStatus === 'locked' && 'bg-amber-500 border-amber-400',
                              displayStatus === 'closed' && 'bg-slate-400 border-slate-300',
                            )}
                            title={STATUS_CONFIG[displayStatus].label}
                            aria-hidden
                          />
                          {readOnly ? (
                            <span className="font-medium">{d.name}</span>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onEdit(d);
                              }}
                              className="text-left font-medium text-primary hover:underline"
                            >
                              {d.name}
                            </button>
                          )}
                          {d.classSection && (
                            <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{d.classSection}</span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">{formatLastSeen(d.last_seen_at ?? null)}</span>
                        {d.roomOrLocation && <span className="text-xs text-muted-foreground"> · {d.roomOrLocation}</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      {session ? (
                        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/80 px-2 py-1.5 dark:border-amber-800 dark:bg-amber-950/30">
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50">
                            <User className="size-4 text-amber-700 dark:text-amber-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-amber-900 dark:text-amber-100">{session.user_name || 'Öğretmen'}</p>
                            <p className="text-xs text-amber-700/80 dark:text-amber-400/80">{formatConnectedAgo(session.connected_at)}</p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {d.current_slot ? (
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                          <span className="font-medium text-primary">{d.current_slot.lesson_num}. ders</span>
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
                      <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700"
                          onClick={() => toast.info('Toplu aç özelliği planlanıyor.')}
                          title="Aç"
                        >
                          <LockOpen className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-primary hover:bg-primary/10"
                          onClick={() => {
                            if (session && onDisconnect) onDisconnect(session.id);
                            else toast.info('Kilitle özelliği planlanıyor.');
                          }}
                          title="Kilitle / bağlantıyı kes"
                        >
                          <Lock className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-muted-foreground hover:bg-muted"
                          onClick={() => (onClose ? onClose(d) : toast.info('Kapat özelliği planlanıyor.'))}
                          title="Kapat"
                        >
                          <XCircle className="size-4" />
                        </Button>
                        {onSchedule && (
                          <Button variant="ghost" size="sm" className="h-8" onClick={() => onSchedule(d)} title="Program">
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
                            title="Bu sınıfa özel /tv/classroom adresini kopyala"
                          >
                            <Monitor className="size-3.5 shrink-0" />
                            <span className="hidden sm:inline">Duyuru TV</span>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    {canManage && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="h-8 text-destructive hover:bg-destructive/10" onClick={() => onDelete(d)}>
                          <Trash2 className="mr-1 size-4" />
                          Sil
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                  {expandedId === d.id ? (
                    <TableRow className="bg-muted/20 hover:bg-muted/25">
                      <TableCell colSpan={colCount} className="border-t border-border/50 py-4 sm:py-5">
                        <DeviceDetailCards
                          d={d}
                          displayStatus={displayStatus}
                          session={session}
                          schoolId={schoolId}
                          onCopyPairingCode={onCopyPairingCode}
                        />
                        <p className="mt-3 text-center text-[11px] text-muted-foreground">Detayı kapatmak için satıra tekrar tıklayın.</p>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
