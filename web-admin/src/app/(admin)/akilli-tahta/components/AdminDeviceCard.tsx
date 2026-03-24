'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Copy, Pencil, Trash2, Clock, Calendar, BookOpen, User, MapPin } from 'lucide-react';
import { SmartBoardIcon } from './SmartBoardIcon';
import type { Device } from '../types';

function formatLastSeen(iso: string | null): string {
  if (!iso) return 'Hiç';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 2) return 'Şimdi';
  if (diffMin < 60) return `${diffMin} dk önce`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} sa önce`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD} gün önce`;
}

export function AdminDeviceCard({
  device,
  readOnly,
  onEdit,
  onDelete,
  onCopyPairingCode,
  onSchedule,
}: {
  device: Device;
  readOnly?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onCopyPairingCode: (code: string) => void;
  onSchedule?: () => void;
}) {
  const isOn = device.status === 'online';
  const fromTimetable = device.current_slot?.source === 'timetable';

  return (
    <div className="group flex flex-col gap-3 rounded-xl border border-border/80 bg-card/50 p-4 shadow-sm transition-all hover:border-primary/20 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div
            className={`flex shrink-0 items-center justify-center rounded-xl p-1 transition-colors ${
              isOn ? 'bg-emerald-500/15' : 'bg-muted/80'
            }`}
            title={isOn ? 'Çevrimiçi' : 'Çevrimdışı'}
          >
            <SmartBoardIcon
              size={44}
              isOnline={isOn}
              className={isOn ? 'text-emerald-600' : 'text-muted-foreground'}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-foreground">{device.name}</p>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  isOn
                    ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {isOn ? 'Çevrimiçi' : 'Çevrimdışı'}
              </span>
              {device.classSection && (
                <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {device.classSection}
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
              {device.roomOrLocation && (
                <span className="flex items-center gap-1">
                  <MapPin className="size-3.5" />
                  {device.roomOrLocation}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="size-3.5" />
                {formatLastSeen(device.last_seen_at ?? null)}
              </span>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 font-mono"
            onClick={() => onCopyPairingCode(device.pairing_code)}
          >
            <Copy className="mr-1.5 size-4" />
            {device.pairing_code}
          </Button>
        </div>
        {!readOnly && (
          <div className="flex shrink-0 gap-1">
            {onSchedule && (
              <Button variant="ghost" size="icon" onClick={onSchedule} aria-label="Program" className="size-9">
                <Calendar className="size-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onEdit} aria-label="Düzenle" className="size-9">
              <Pencil className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onDelete} aria-label="Sil" className="size-9 text-destructive">
              <Trash2 className="size-4" />
            </Button>
          </div>
        )}
      </div>
      {device.current_slot && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
          <span className="inline-flex items-center gap-1.5 font-semibold text-primary">
            <BookOpen className="size-4" aria-hidden />
            {device.current_slot.lesson_num}. Ders
          </span>
          <span className="inline-flex items-center gap-1.5">
            <BookOpen className="size-4 shrink-0 text-primary/70" aria-hidden />
            {device.current_slot.subject}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <User className="size-4 shrink-0 text-primary/70" aria-hidden />
            {device.current_slot.teacher_name}
          </span>
          {device.current_slot.class_section && (
            <span className="text-muted-foreground">({device.current_slot.class_section})</span>
          )}
          {fromTimetable && (
            <Link
              href="/ders-programi"
              className="ml-auto rounded-md bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary hover:bg-primary/25"
            >
              Ders programından
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
