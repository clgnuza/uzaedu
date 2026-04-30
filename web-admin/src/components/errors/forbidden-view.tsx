'use client';

import Link from 'next/link';
import { LayoutDashboard, ShieldOff } from 'lucide-react';

type ForbiddenViewProps = {
  title?: string;
  description?: string;
};

export function ForbiddenView({
  title = 'Bu sayfaya erişim yetkiniz yok',
  description = 'Bu alan rolünüzle kullanıma açık değil. Ana sayfaya dönüp yetkili olduğunuz işlemlere devam edebilirsiniz.',
}: ForbiddenViewProps) {
  return (
    <div className="relative flex min-h-[min(100dvh,720px)] w-full items-center justify-center overflow-hidden px-4 py-10 sm:py-14">
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-90" aria-hidden>
        <div className="absolute -left-1/4 top-0 h-72 w-72 rounded-full bg-violet-500/25 blur-3xl sm:h-96 sm:w-96" />
        <div className="absolute -right-1/4 bottom-0 h-64 w-64 rounded-full bg-cyan-500/20 blur-3xl sm:h-80 sm:w-80" />
        <div className="absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fuchsia-500/15 blur-2xl" />
      </div>

      <div className="relative w-full max-w-[min(100%,420px)]">
        <div className="absolute inset-0 rounded-3xl bg-linear-to-br from-violet-600/20 via-fuchsia-500/10 to-cyan-500/20 p-px shadow-lg shadow-violet-500/10">
          <div className="h-full w-full rounded-3xl bg-background/95 backdrop-blur-md dark:bg-background/90" />
        </div>

        <div className="relative space-y-5 rounded-3xl border border-border/60 bg-card/70 px-5 py-7 shadow-xl backdrop-blur-sm sm:space-y-6 sm:px-8 sm:py-8">
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:text-left">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-500/35 ring-4 ring-violet-500/10 sm:size-16">
              <ShieldOff className="size-7 sm:size-8" strokeWidth={1.75} aria-hidden />
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-600 dark:text-violet-400">
                403 · Erisim reddedildi
              </p>
              <h1 className="text-balance text-xl font-bold leading-tight tracking-tight text-foreground sm:text-2xl">
                {title}
              </h1>
            </div>
          </div>

          <p className="text-pretty text-center text-sm leading-relaxed text-muted-foreground sm:text-left sm:text-[15px]">
            {description}
          </p>

          <div className="flex flex-col gap-2.5 pt-1 sm:flex-row sm:justify-center sm:pt-0">
            <Link
              href="/dashboard"
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-violet-600 to-fuchsia-600 px-5 text-sm font-semibold text-white shadow-md shadow-violet-500/25 transition hover:brightness-110 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-auto sm:min-w-[200px]"
            >
              <LayoutDashboard className="size-4 shrink-0 opacity-90" aria-hidden />
              Ana sayfaya don
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
