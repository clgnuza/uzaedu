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
        'overflow-hidden rounded-xl border bg-card/90 transition-colors',
        isConnected
          ? 'border-emerald-500/45 ring-1 ring-emerald-500/20'
          : isOn
            ? 'border-teal-200/60 dark:border-teal-800/45'
            : 'border-border/70',
      )}
    >
      <div className="flex items-center gap-2 p-2.5 sm:p-3">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
          onClick={() => setDetailOpen((v) => !v)}
          aria-expanded={detailOpen}
        >
          <SmartBoardIcon
            size={32}
            isOnline={isOn}
            className={cn('shrink-0', isOn ? 'text-emerald-600' : 'text-muted-foreground')}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <p className="truncate text-sm font-semibold">{device.name}</p>
              {detailOpen ? (
                <ChevronUp className="size-3.5 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
              )}
            </div>
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
              <span
                className={cn(
                  'rounded px-1 py-px font-medium',
                  isOn ? 'bg-emerald-500/12 text-emerald-800 dark:text-emerald-200' : 'bg-muted text-muted-foreground',
                )}
              >
                {isOn ? 'Çevrimiçi' : 'Kapalı'}
              </span>
              {device.classSection ? (
                <span className="rounded bg-primary/10 px-1 py-px font-medium text-primary">{device.classSection}</span>
              ) : null}
              {isConnected ? <span className="text-emerald-700 dark:text-emerald-300">Aktif</span> : null}
              {device.lesson_context?.my_lesson_now ? (
                <span className="rounded bg-amber-500/15 px-1 py-px font-medium text-amber-900 dark:text-amber-100">
                  Dersim şimdi
                </span>
              ) : null}
              {device.lesson_context?.busy_teacher_name ? (
                <span className="text-amber-800 dark:text-amber-200">{device.lesson_context.busy_teacher_name}</span>
              ) : null}
            </p>
            {device.roomOrLocation ? (
              <p className="mt-0.5 flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <MapPin className="size-3 shrink-0" />
                <span className="truncate">{device.roomOrLocation}</span>
              </p>
            ) : null}
          </div>
        </button>

        {/* Yedek panel oturumu — QR birincil akış */}
        <div className="hidden shrink-0 sm:block">
          {isConnected && sessionId ? (
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onDisconnect}>
              <PowerOff className="size-3.5" />
              Kes
            </Button>
          ) : (
            <Button
              variant={device.lesson_context?.reconnect_without_qr ? 'secondary' : 'ghost'}
              size="sm"
              disabled={isConnecting}
              onClick={onConnect}
              className="h-8 text-[10px]"
            >
              {isConnecting ? <LoadingSpinner className="size-3.5" /> : <Power className="size-3.5" />}
              {device.lesson_context?.reconnect_without_qr ? 'Devam' : 'Yedek'}
            </Button>
          )}
        </div>
      </div>

      {detailOpen && (
        <div className="space-y-1.5 border-t border-border/50 bg-muted/20 px-2.5 py-2 text-[10px] leading-relaxed text-muted-foreground sm:px-3">
          {device.lesson_context?.current_slot ? (
            <p>
              <span className="font-medium text-foreground">Şu an:</span>{' '}
              {device.lesson_context.current_slot.lesson_num}. ders — {device.lesson_context.current_slot.subject} (
              {device.lesson_context.current_slot.teacher_name})
            </p>
          ) : device.current_slot ? (
            <p>
              <span className="font-medium text-foreground">Program:</span> {device.current_slot.lesson_num}. ders —{' '}
              {device.current_slot.subject}
            </p>
          ) : null}
          {device.lesson_context?.my_next_lesson ? (
            <p>
              <span className="font-medium text-foreground">Sıradaki dersiniz:</span>{' '}
              {device.lesson_context.my_next_lesson.lesson_num}. ders — {device.lesson_context.my_next_lesson.subject}
              {device.lesson_context.my_next_lesson.starts_in_minutes > 0
                ? ` (~${device.lesson_context.my_next_lesson.starts_in_minutes} dk)`
                : ''}
            </p>
          ) : null}
          <p>
            {device.lesson_context?.reconnect_without_qr ? (
              <>
                Son oturumunuz yakın: <strong className="text-foreground">QR olmadan devam</strong> edebilirsiniz.
              </>
            ) : (
              <>
                Normal akış: tahtadaki <strong className="text-foreground">QR</strong> ile ders oturumu.
              </>
            )}
          </p>
          <div className="flex gap-2 pt-1 sm:hidden">
            {isConnected && sessionId ? (
              <Button variant="outline" size="sm" className="h-8 flex-1 text-xs" onClick={onDisconnect}>
                Bağlantıyı kes
              </Button>
            ) : (
              <Button
                variant={device.lesson_context?.reconnect_without_qr ? 'default' : 'secondary'}
                size="sm"
                disabled={isConnecting}
                className="h-8 flex-1 text-xs"
                onClick={onConnect}
              >
                {isConnecting ? (
                  <LoadingSpinner className="size-3.5" />
                ) : device.lesson_context?.reconnect_without_qr ? (
                  'QR’sız devam'
                ) : (
                  'Yedek bağlan'
                )}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
