'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Settings2,
  ListChecks,
  Scale,
  Heart,
  Building2,
  BarChart3,
  Users,
  BookOpen,
  GitBranch,
  Layers,
  CalendarRange,
  Archive,
  Grid3x3,
} from 'lucide-react';

import { STUDIO_DATA_PAGES } from '@/lib/ders-dagit-studio-nav';

const ICON_BY_HREF: Record<string, typeof Settings2> = {
  '/ders-dagit/studyo/kurulum': Settings2,
  '/ders-dagit/studyo/donem': CalendarRange,
  '/ders-dagit/studyo/sinif-saatleri': Grid3x3,
  '/ders-dagit/studyo/ogretmenler': Users,
  '/ders-dagit/studyo/dersler': BookOpen,
  '/ders-dagit/studyo/gruplar': GitBranch,
  '/ders-dagit/studyo/secmeli': Layers,
  '/ders-dagit/studyo/derslikler': Building2,
  '/ders-dagit/studyo/atamalar': ListChecks,
  '/ders-dagit/studyo/planlama-iliskileri': GitBranch,
  '/ders-dagit/studyo/kurallar': Scale,
  '/ders-dagit/studyo/arsiv': Archive,
  '/ders-dagit/studyo/adalet': BarChart3,
};

const STEPS = STUDIO_DATA_PAGES.map((p) => ({
  ...p,
  icon: ICON_BY_HREF[p.href] ?? Settings2,
}));

const ACTIVE = 'dd-nav-pill-active';
const IDLE = 'dd-nav-pill text-muted-foreground hover:text-foreground';

export function DersDagitStudioNav({ healthScore }: { healthScore?: number }) {
  const pathname = usePathname();
  return (
    <nav className="dd-glass dd-glass-subtle dd-nav-scroll flex gap-1 overflow-x-auto rounded-xl p-1.5 pb-1 lg:flex-wrap lg:gap-1.5 lg:overflow-visible lg:pb-1.5">
      {STEPS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all sm:gap-1.5 sm:px-3 sm:py-2 sm:text-sm',
              active ? ACTIVE : IDLE,
            )}
          >
            <Icon className="size-3.5 shrink-0 sm:size-4" />
            {label}
          </Link>
        );
      })}
      {healthScore != null && (
        <span
          className={cn(
            'ml-auto inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold sm:px-3 sm:text-xs',
            healthScore >= 80
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200'
              : healthScore >= 50
                ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100'
                : 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-100',
          )}
        >
          <Heart className="size-3 sm:size-3.5" />
          Sağlık {healthScore}
        </span>
      )}
    </nav>
  );
}
