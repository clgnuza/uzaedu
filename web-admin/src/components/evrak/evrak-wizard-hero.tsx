'use client';

import Link from 'next/link';
import { HelpCircle, ShoppingBag } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function EvrakHeroIcon({ className, size = 46 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <rect x="10" y="6" width="28" height="36" rx="4" className="fill-sky-500/15 dark:fill-sky-400/12" />
      <path
        d="M16 14h16M16 20h12M16 26h16M16 32h10"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        className="text-sky-800/85 dark:text-sky-200/90"
      />
      <path
        d="M28 36l3 3 7-7"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-emerald-600 dark:text-emerald-400"
      />
    </svg>
  );
}

export function EvrakWizardHero({
  onOpenGuide,
  archiveCount,
  templatesTotal,
  showQuota,
  evrakEntitlement,
  noEvrakQuota,
  defaultsIncomplete,
}: {
  onOpenGuide: () => void;
  archiveCount: number;
  templatesTotal: number | null;
  showQuota: boolean;
  evrakEntitlement: number | null;
  noEvrakQuota: boolean;
  defaultsIncomplete: boolean;
}) {
  return (
    <Card className="mb-1 overflow-hidden border-sky-200/55 bg-linear-to-br from-sky-500/8 via-background to-cyan-500/5 shadow-sm ring-1 ring-sky-500/10 dark:border-sky-900/45 sm:mb-2">
      <CardContent className="space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 gap-3 sm:items-center">
            <div className="flex size-13 shrink-0 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-700 ring-1 ring-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300 sm:size-16">
              <EvrakHeroIcon size={44} />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <h1 className="text-base font-bold tracking-tight sm:text-lg">Evrak</h1>
              <p className="text-[11px] leading-snug text-muted-foreground sm:text-xs">
                Sınıf ve ders seçin; şablonu açıp üretin. İndirdikleriniz arşivde kalır.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full border border-amber-300/50 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-950 dark:border-amber-800 dark:text-amber-100 sm:text-xs">
                  Arşiv {archiveCount}
                </span>
                <span className="inline-flex items-center rounded-full border border-emerald-300/50 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-900 dark:border-emerald-800 dark:text-emerald-100 sm:text-xs">
                  {templatesTotal === null ? 'Şablon —' : `Liste ${templatesTotal}`}
                </span>
                {showQuota && evrakEntitlement !== null && (
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold sm:text-xs',
                      noEvrakQuota || evrakEntitlement <= 0
                        ? 'border-rose-300/50 bg-rose-500/10 text-rose-900 dark:border-rose-800 dark:text-rose-100'
                        : 'border-violet-300/50 bg-violet-500/10 text-violet-900 dark:border-violet-800 dark:text-violet-100',
                    )}
                  >
                    Kota {evrakEntitlement}
                  </span>
                )}
              </div>
              {defaultsIncomplete && (
                <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400 sm:text-xs">
                  Okul / müdür varsayılanı yok —{' '}
                  <Link href="/settings" className="underline-offset-2 hover:underline">
                    Ayarlar
                  </Link>
                </p>
              )}
              {showQuota && noEvrakQuota && (
                <Link
                  href="/market"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline sm:text-xs"
                >
                  <ShoppingBag className="size-3.5 shrink-0" />
                  Marketten evrak hakkı
                </Link>
              )}
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 gap-1.5 rounded-xl text-xs sm:h-9 sm:text-sm" onClick={onOpenGuide}>
            <HelpCircle className="size-3.5 sm:size-4" />
            Rehber
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
