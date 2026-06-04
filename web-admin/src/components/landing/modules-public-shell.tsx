import Link from 'next/link';
import { ArrowLeft, LayoutGrid, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';

export function ModulesPublicShell({
  children,
  showAllModulesLink = false,
}: {
  children: ReactNode;
  showAllModulesLink?: boolean;
}) {
  return (
    <div className="modules-public-page relative min-h-dvh overflow-x-hidden bg-[#050505] text-zinc-100">
      <div className="modules-public-bg pointer-events-none fixed inset-0" aria-hidden />
      <div className="modules-public-bg-glow pointer-events-none fixed inset-0" aria-hidden />

      <header className="relative z-20 border-b border-zinc-800/60 bg-zinc-950/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3.5 sm:px-8">
          <Link href="/" className="modules-public-nav-chip">
            <ArrowLeft className="size-3.5 shrink-0 opacity-80" aria-hidden />
            Ana sayfa
          </Link>
          {showAllModulesLink ? (
            <Link href="/moduller" className="modules-public-nav-chip modules-public-nav-chip--active">
              <LayoutGrid className="size-3.5 shrink-0 opacity-90" aria-hidden />
              Tüm modüller
            </Link>
          ) : (
            <Link href="/moduller" className="modules-public-nav-chip">
              <LayoutGrid className="size-3.5 shrink-0 opacity-80" aria-hidden />
              Modüller
            </Link>
          )}
        </div>
      </header>

      <div className="relative z-10">{children}</div>
    </div>
  );
}

export function ModulesPublicHero({
  eyebrow,
  title,
  description,
  moduleCount,
}: {
  eyebrow: string;
  title: string;
  description: string;
  moduleCount?: number;
}) {
  return (
    <div className="modules-public-hero-card">
      <div className="modules-public-hero-card-inner">
        <div className="modules-public-hero-glow" aria-hidden />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
          <span className="modules-public-hero-icon flex size-14 shrink-0 items-center justify-center rounded-2xl sm:size-16">
            <LayoutGrid className="size-7 sm:size-8" strokeWidth={1.5} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="modules-public-hero-eyebrow">{eyebrow}</p>
              {moduleCount != null && (
                <span className="modules-public-hero-badge">
                  <Sparkles className="size-3 shrink-0 text-amber-200/90" aria-hidden />
                  <span className="tabular-nums text-red-300">{moduleCount}</span> modül
                </span>
              )}
            </div>
            <h1 className="modules-public-hero-title">{title}</h1>
            <p className="modules-public-hero-desc">{description}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
