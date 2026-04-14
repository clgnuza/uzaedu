'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Power, PowerOff, MapPin, ChevronDown, ChevronUp } from 'lucide-react';
import { SmartBoardIcon } from './SmartBoardIcon';
import { cn } from '@/lib/utils';
import type { Device } from '../types';

export function TeacherDeviceCard({
  device,
  isConnected,
  isConnecting,
  onConnect,
  onDisconnect,
  sessionId,
}: {
  device: Device;
  isConnected: boolean;
  isConnecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  sessionId: string | undefined;
}) {
  const [detailOpen, setDetailOpen] = useState(false);
  const isOn = device.status === 'online';

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border bg-card/80 shadow-sm transition-colors sm:rounded-xl',
        isConnected
          ? 'border-emerald-500/50 ring-1 ring-emerald-500/25'
          : isOn
            ? 'border-teal-200/70 dark:border-teal-800/50'
            : 'border-border/70',
      )}
    >
      <div className="flex items-stretch gap-2 p-2 sm:gap-3 sm:p-3.5">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left sm:gap-3"
          onClick={() => setDetailOpen((v) => !v)}
          aria-expanded={detailOpen}
        >
          <div
            className={cn(
              'flex shrink-0 items-center justify-center rounded-lg p-0.5 sm:rounded-xl sm:p-1',
              isOn ? 'bg-emerald-500/12' : 'bg-muted/70',
            )}
          >
            <SmartBoardIcon
              size={28}
              isOnline={isOn}
              className={cn('sm:hidden', isOn ? 'text-emerald-600' : 'text-muted-foreground')}
            />
            <SmartBoardIcon
              size={36}
              isOnline={isOn}
              className={cn('hidden sm:block', isOn ? 'text-emerald-600' : 'text-muted-foreground')}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-semibold sm:text-base">{device.name}</p>
              {detailOpen ? (
                <ChevronUp className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              ) : (
                <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              )}
            </div>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-muted-foreground sm:text-xs">
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 rounded px-1 py-px font-medium',
                  isOn ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200' : 'bg-slate-500/12 text-slate-600 dark:text-slate-400',
                )}
              >
                {isOn ? 'Çevrimiçi' : 'Çevrimdışı'}
              </span>
              {isConnected ? (
                <span className="text-emerald-700 dark:text-emerald-300">· Bu tahtaya bağlısınız</span>
              ) : null}
            </p>
            <p className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground sm:text-xs">
              {device.roomOrLocation && (
                <span className="inline-flex items-center gap-0.5">
                  <MapPin className="size-3 shrink-0" />
                  {device.roomOrLocation}
                </span>
              )}
              {device.classSection && (
                <span className="rounded bg-primary/10 px-1 py-px text-[10px] font-medium text-primary">{device.classSection}</span>
              )}
              <span className="font-mono text-[10px]">· {device.pairing_code}</span>
            </p>
          </div>
        </button>
        <div className="flex shrink-0 flex-col justify-center border-l border-border/50 pl-2">
          {isConnected && sessionId ? (
            <Button variant="outline" size="sm" onClick={onDisconnect} className="h-8 px-2 text-[10px] text-amber-700 sm:h-9 sm:px-3 sm:text-xs">
              <PowerOff className="mr-0.5 size-3.5 sm:mr-1 sm:size-4" />
              Kes
            </Button>
          ) : (
            <Button variant="default" size="sm" disabled={isConnecting} onClick={onConnect} className="h-8 px-2 text-[10px] sm:h-9 sm:px-3 sm:text-xs">
              {isConnecting ? <LoadingSpinner className="size-3.5 sm:mr-1 sm:size-4" /> : <Power className="mr-0.5 size-3.5 sm:mr-1 sm:size-4" />}
              Bağlan
            </Button>
          )}
        </div>
      </div>
      {detailOpen && (
        <div className="space-y-1.5 border-t border-border/60 bg-muted/25 px-2.5 py-2 text-[10px] leading-relaxed text-muted-foreground sm:px-4 sm:text-xs">
          {device.current_slot ? (
            <p>
              <span className="font-medium text-foreground">Şu an (program):</span>{' '}
              {device.current_slot.lesson_num}. ders — {device.current_slot.subject} · {device.current_slot.teacher_name}
            </p>
          ) : (
            <p className="text-muted-foreground">Bu slotta ders programı kaydı yok.</p>
          )}
          <p>
            <span className="font-medium text-foreground">Durum:</span>{' '}
            {isOn ? 'Tahta sunucuya bağlı; bağlanabilirsiniz.' : 'Tahta kapalı veya ağda değil; sınıfta cihazı kontrol edin.'}
          </p>
        </div>
      )}
    </div>
  );
}
