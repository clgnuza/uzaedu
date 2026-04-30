'use client';

import Link from 'next/link';
import { FileQuestion, Home, LayoutDashboard, LogIn } from 'lucide-react';

type NotFoundContext = 'public' | 'admin';

export function NotFoundView({ context }: { context: NotFoundContext }) {
  const isAdmin = context === 'admin';

  return (
    <div className="relative flex min-h-[min(100dvh,720px)] w-full items-center justify-center overflow-hidden px-4 py-10 sm:py-14">
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-90" aria-hidden>
        <div className="absolute -left-1/4 top-0 h-72 w-72 rounded-full bg-cyan-500/25 blur-3xl sm:h-96 sm:w-96" />
        <div className="absolute -right-1/4 bottom-0 h-64 w-64 rounded-full bg-sky-500/20 blur-3xl sm:h-80 sm:w-80" />
        <div className="absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-400/12 blur-2xl" />
      </div>

      <div className="relative w-full max-w-[min(100%,420px)]">
        <div className="absolute inset-0 rounded-3xl bg-linear-to-br from-cyan-600/20 via-sky-500/12 to-amber-500/10 p-px shadow-lg shadow-cyan-500/10">
          <div className="h-full w-full rounded-3xl bg-background/95 backdrop-blur-md dark:bg-background/90" />
        </div>

        <div className="relative space-y-5 rounded-3xl border border-border/60 bg-card/70 px-5 py-7 shadow-xl backdrop-blur-sm sm:space-y-6 sm:px-8 sm:py-8">
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:text-left">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-cyan-600 to-sky-600 text-white shadow-lg shadow-cyan-500/35 ring-4 ring-cyan-500/10 sm:size-16">
              <FileQuestion className="size-7 sm:size-8" strokeWidth={1.75} aria-hidden />
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-600 dark:text-cyan-400">
                404 · Sayfa bulunamadı
              </p>
              <h1 className="text-balance text-xl font-bold leading-tight tracking-tight text-foreground sm:text-2xl">
                Aradığınız sayfa burada değil
              </h1>
            </div>
          </div>

          <p className="text-pretty text-center text-sm leading-relaxed text-muted-foreground sm:text-left sm:text-[15px]">
            Adres yanlış yazılmış, sayfa taşınmış veya kaldırılmış olabilir. Ana sayfadan veya panelden devam
            edebilirsiniz.
          </p>

          <div className="flex flex-col gap-2.5 pt-1 sm:flex-row sm:flex-wrap sm:justify-center sm:pt-0">
            {isAdmin ? (
              <>
                <Link
                  href="/dashboard"
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-cyan-600 to-sky-600 px-5 text-sm font-semibold text-white shadow-md shadow-cyan-500/25 transition hover:brightness-110 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-auto sm:min-w-[180px]"
                >
                  <LayoutDashboard className="size-4 shrink-0 opacity-90" aria-hidden />
                  Panele dön
                </Link>
                <Link
                  href="/"
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-background/80 px-5 text-sm font-semibold text-foreground shadow-sm transition hover:bg-muted/60 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-auto sm:min-w-[160px]"
                >
                  <Home className="size-4 shrink-0 opacity-80" aria-hidden />
                  Site ana sayfası
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/"
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-cyan-600 to-sky-600 px-5 text-sm font-semibold text-white shadow-md shadow-cyan-500/25 transition hover:brightness-110 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-auto sm:min-w-[180px]"
                >
                  <Home className="size-4 shrink-0 opacity-90" aria-hidden />
                  Ana sayfa
                </Link>
                <Link
                  href="/login"
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-background/80 px-5 text-sm font-semibold text-foreground shadow-sm transition hover:bg-muted/60 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-auto sm:min-w-[160px]"
                >
                  <LogIn className="size-4 shrink-0 opacity-80" aria-hidden />
                  Giriş yap
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
