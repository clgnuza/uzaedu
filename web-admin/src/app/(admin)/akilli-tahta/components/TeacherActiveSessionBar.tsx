'use client';

import { Button } from '@/components/ui/button';
import { Monitor, PowerOff } from 'lucide-react';

export function TeacherActiveSessionBar({
  deviceName,
  onDisconnect,
}: {
  deviceName: string;
  onDisconnect: () => void;
}) {
  return (
    <div className="mb-2 flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2.5 shadow-sm sm:mb-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
        <Monitor className="size-4 text-emerald-700 dark:text-emerald-300" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-emerald-900 dark:text-emerald-100">{deviceName}</p>
        <p className="text-[11px] text-muted-foreground">Bağlantı aktif · tahta kullanım modunda</p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 shrink-0 border-amber-300/80 px-3 text-xs"
        onClick={onDisconnect}
      >
        <PowerOff className="size-3.5" />
        <span className="sr-only sm:not-sr-only sm:ml-1">Kes</span>
      </Button>
    </div>
  );
}
