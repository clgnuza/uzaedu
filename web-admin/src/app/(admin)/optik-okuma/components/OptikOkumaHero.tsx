'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { OptikStatus } from '@/lib/optik-api';
import {
  ChevronRight,
  FileStack,
  Home,
  RefreshCw,
  ScanLine,
  Zap,
} from 'lucide-react';

export function OptikOkumaHero({
  ready,
  status,
  loading,
  onRefresh,
}: {
  ready: boolean;
  status: OptikStatus | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  const limit = status?.daily_limit_per_user;
  const used = status?.usage_today ?? 0;
  const pct = limit && limit > 0 ? Math.min(100, (used / limit) * 100) : 0;

  return (
    <div className="relative overflow-hidden rounded-xl border border-fuchsia-500/20 bg-linear-to-br from-fuchsia-600 via-violet-600 to-cyan-600 px-3 py-2.5 text-white shadow-md shadow-fuchsia-500/15 md:rounded-2xl md:px-4 md:py-3">
      <nav className="relative mb-2 flex items-center gap-0.5 text-white/75">
        <Link
          href="/dashboard"
          title="Anasayfa"
          className="flex size-7 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20"
        >
          <Home className="size-3.5" />
        </Link>
        <ChevronRight className="size-3 opacity-50" />
        <Link href="/optik-formlar" title="Formlar" className="flex size-7 items-center justify-center rounded-lg hover:bg-white/15">
          <FileStack className="size-3.5" />
        </Link>
        <ChevronRight className="size-3 opacity-50" />
        <span title="Serbest tarama" className="flex size-7 items-center justify-center rounded-lg bg-white/15">
          <ScanLine className="size-3.5" />
        </span>
      </nav>

      <div className="relative flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/15 md:size-9 md:rounded-xl">
            <ScanLine className="size-4 md:size-5" strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold md:text-lg">Serbest tarama</h1>
            <p className="hidden truncate text-[11px] text-white/75 md:block">
              Oturumsuz · sınav için oturum
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span
            title={ready ? 'Sistem hazır' : status?.enabled ? 'Yapılandırma eksik' : 'Modül kapalı'}
            className={cn(
              'flex size-8 items-center justify-center rounded-lg ring-1',
              ready
                ? 'bg-emerald-400/25 ring-emerald-300/40'
                : 'bg-amber-400/25 ring-amber-300/40',
            )}
          >
            <Zap className="size-3.5" />
          </span>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            title="Yenile"
            className="size-8 rounded-lg bg-white/10 text-white hover:bg-white/20"
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {limit != null && limit > 0 ? (
        <div className="relative mt-2" title={`Günlük ${used}/${limit}`}>
          <div className="h-1 overflow-hidden rounded-full bg-black/25">
            <div
              className="h-full rounded-full bg-linear-to-r from-cyan-300 to-emerald-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="mt-0.5 block text-end text-[9px] text-white/70 md:hidden">
            {used}/{limit}
          </span>
        </div>
      ) : null}
    </div>
  );
}
