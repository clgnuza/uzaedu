'use client';

import { cn } from '@/lib/utils';
import type { OptikStatus } from '@/lib/optik-api';
import { AlertCircle, Sparkles, WifiOff } from 'lucide-react';

export function OptikStatusBanner({ status }: { status: OptikStatus | null }) {
  if (!status || status.ready) return null;

  if (!status.enabled) {
    return (
      <div
        role="alert"
        className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-[11px] text-red-900 dark:text-red-100"
        title="Okul yöneticisi optik modülünü açmalı"
      >
        <WifiOff className="size-4 shrink-0" />
        <span className="font-medium">Optik modülü kapalı</span>
      </div>
    );
  }

  return (
    <div
      role="alert"
      className={cn(
        'flex items-center gap-2 rounded-xl border px-2.5 py-2 text-[11px]',
        'border-amber-500/35 bg-amber-500/10 text-amber-950 dark:text-amber-100',
      )}
      title="OpenAI API anahtarı tanımlanmalı"
    >
      <AlertCircle className="size-4 shrink-0" />
      <span className="font-medium">Yapılandırma eksik</span>
      <Sparkles className="ml-auto size-3.5 opacity-60" />
    </div>
  );
}
