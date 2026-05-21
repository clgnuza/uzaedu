'use client';

import { useEffect, useState } from 'react';
import { Bell, Power, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ClassroomShutdownWarning = {
  kind: 'duyuru' | 'close';
  seconds_left: number;
  title: string;
  detail: string;
};

function formatCountdown(totalSec: number): string {
  const sec = Math.max(0, totalSec);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function ClassroomShutdownWarningOverlay({
  warning,
}: {
  warning: ClassroomShutdownWarning | null;
}) {
  const [left, setLeft] = useState(warning?.seconds_left ?? 0);

  useEffect(() => {
    if (!warning) {
      setLeft(0);
      return;
    }
    setLeft(warning.seconds_left);
    const id = setInterval(() => {
      setLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [warning?.seconds_left, warning?.kind, warning?.title]);

  useEffect(() => {
    if (warning?.seconds_left != null) setLeft(warning.seconds_left);
  }, [warning?.seconds_left]);

  if (!warning || left <= 0) return null;

  const isClose = warning.kind === 'close';
  const pct =
    warning.seconds_left > 0
      ? Math.min(100, Math.round(((warning.seconds_left - left) / warning.seconds_left) * 100))
      : 0;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[95] flex items-center justify-center bg-black/55 p-4 backdrop-blur-md"
      role="alertdialog"
      aria-live="assertive"
      aria-label={warning.title}
    >
      <div
        className={cn(
          'pointer-events-auto w-full max-w-md overflow-hidden rounded-2xl border shadow-2xl',
          isClose
            ? 'border-rose-400/35 bg-linear-to-br from-rose-950/95 via-slate-950/95 to-slate-900/90'
            : 'border-amber-400/35 bg-linear-to-br from-amber-950/95 via-slate-950/95 to-slate-900/90',
        )}
      >
        <div
          className={cn(
            'flex items-center gap-3 border-b px-5 py-4',
            isClose ? 'border-rose-500/25 bg-rose-500/10' : 'border-amber-500/25 bg-amber-500/10',
          )}
        >
          <span
            className={cn(
              'flex size-11 items-center justify-center rounded-xl ring-1',
              isClose
                ? 'bg-rose-500/20 text-rose-200 ring-rose-400/30'
                : 'bg-amber-500/20 text-amber-200 ring-amber-400/30',
            )}
          >
            {isClose ? <Power className="size-5" aria-hidden /> : <Bell className="size-5" aria-hidden />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wider text-white/55">Otomatik geçiş</p>
            <h2 className="truncate text-lg font-semibold text-white">{warning.title}</h2>
          </div>
        </div>

        <div className="space-y-4 px-5 py-5">
          <p className="text-sm leading-relaxed text-white/80">{warning.detail}</p>

          <div className="flex items-center gap-4">
            <div className="relative size-20 shrink-0">
              <svg className="size-20 -rotate-90" viewBox="0 0 36 36" aria-hidden>
                <circle
                  cx="18"
                  cy="18"
                  r="15.5"
                  fill="none"
                  className="stroke-white/10"
                  strokeWidth="2.5"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="15.5"
                  fill="none"
                  className={cn(
                    'transition-all duration-1000',
                    isClose ? 'stroke-rose-400' : 'stroke-amber-400',
                  )}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray={`${pct} 100`}
                  pathLength={100}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Timer className="mb-0.5 size-3.5 text-white/50" aria-hidden />
                <span className="font-mono text-xl font-bold tabular-nums tracking-tight text-white">
                  {formatCountdown(left)}
                </span>
              </div>
            </div>
            <div className="min-w-0 flex-1 space-y-1 text-xs text-white/65">
              <p>
                {isClose
                  ? 'Süre dolunca tahta kapatılır ve duyuru yayını durur.'
                  : 'Süre dolunca ders oturumu kapanır; duyuru slaytları gösterilir.'}
              </p>
              <p className="text-white/45">Okul yöneticisi ayarından değiştirilebilir.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
