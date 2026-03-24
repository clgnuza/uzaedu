'use client';

import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Power, PowerOff, MapPin } from 'lucide-react';
import { SmartBoardIcon } from './SmartBoardIcon';
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
  const isOn = device.status === 'online';

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border/80 bg-card/50 p-4 shadow-sm transition-all hover:border-primary/20">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <div
          className={`flex shrink-0 items-center justify-center rounded-xl p-1 ${
            isOn ? 'bg-emerald-500/15' : 'bg-muted/80'
          }`}
        >
          <SmartBoardIcon
            size={40}
            isOnline={isOn}
            className={isOn ? 'text-emerald-600' : 'text-muted-foreground'}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{device.name}</p>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            {device.roomOrLocation && (
              <>
                <MapPin className="size-3.5 shrink-0" />
                {device.roomOrLocation}
              </>
            )}
            {device.classSection && (
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                {device.classSection}
              </span>
            )}
            <span className="font-mono text-xs">· {device.pairing_code}</span>
          </p>
          {device.current_slot && (
            <p className="mt-1 text-xs text-muted-foreground">
              Şu an: {device.current_slot.lesson_num}. Ders — {device.current_slot.subject} · {device.current_slot.teacher_name}
            </p>
          )}
        </div>
      </div>
      <div>
        {isConnected && sessionId ? (
          <Button variant="outline" size="sm" onClick={onDisconnect} className="text-amber-600">
            <PowerOff className="mr-1 size-4" />
            Bağlantıyı Kes
          </Button>
        ) : (
          <Button
            variant="default"
            size="sm"
            disabled={isConnecting}
            onClick={onConnect}
          >
            {isConnecting ? <LoadingSpinner className="mr-1 size-4" /> : <Power className="mr-1 size-4" />}
            Bağlan
          </Button>
        )}
      </div>
    </div>
  );
}
