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
  SlidersHorizontal,
  Clock,
  LayoutGrid,
} from 'lucide-react';

import { STUDIO_NAV_GROUPS } from '@/lib/ders-dagit-studio-nav';

const ICON_BY_HREF: Record<string, typeof Settings2> = {
  '/ders-dagit/studyo/kurulum': Settings2,
  '/ders-dagit/studyo/donem': CalendarRange,
  '/ders-dagit/studyo/sinif-saatleri': Grid3x3,
  '/ders-dagit/studyo/ogretmenler': Users,
  '/ders-dagit/studyo/ogretmen-tercihleri': Users,
  '/ders-dagit/studyo/dersler': BookOpen,
  '/ders-dagit/studyo/gruplar': GitBranch,
  '/ders-dagit/studyo/secmeli': Layers,
  '/ders-dagit/studyo/derslikler': Building2,
  '/ders-dagit/studyo/binalar': SlidersHorizontal,
  '/ders-dagit/studyo/atamalar': ListChecks,
  '/ders-dagit/studyo/planlama-iliskileri': GitBranch,
  '/ders-dagit/studyo/kurallar': Scale,
  '/ders-dagit/studyo/arsiv': Archive,
  '/ders-dagit/studyo/adalet': BarChart3,
};

const GROUP_ICON: Record<string, typeof Clock> = {
  time: Clock,
  people: Users,
  lessons: BookOpen,
  rooms: Building2,
  dist: LayoutGrid,
  more: Archive,
};

const ACTIVE = 'dd-nav-pill-active';
const IDLE = 'dd-nav-pill text-muted-foreground hover:text-foreground';

export function DersDagitStudioNav({ healthScore }: { healthScore?: number }) {
  const pathname = usePathname();

  return (
    <nav className="dd-glass dd-glass-subtle rounded-xl p-2 sm:p-2.5">
      <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:gap-3">
        {STUDIO_NAV_GROUPS.map((group) => {
          const GroupIcon = GROUP_ICON[group.id] ?? Settings2;
          return (
            <div
              key={group.id}
              className="flex min-w-0 flex-col gap-1 rounded-lg border border-border/40 bg-card/30 p-2"
            >
              <div className="flex items-center gap-1.5 px-0.5 lg:px-1">
                <GroupIcon className="size-3 shrink-0 text-[rgb(var(--dd-accent))] opacity-80" aria-hidden />
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </span>
              </div>
              <div className="flex gap-1 lg:flex-wrap">
                {group.items.map(({ href, label }) => {
                  const active = pathname === href || pathname.startsWith(`${href}/`);
                  const Icon = ICON_BY_HREF[href] ?? Settings2;
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={cn(
                        'inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-all sm:gap-1.5 sm:px-2.5 sm:text-xs',
                        active ? ACTIVE : IDLE,
                      )}
                    >
                      <Icon className="size-3 shrink-0 sm:size-3.5" />
                      {label}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
        {healthScore != null && (
          <div className="flex shrink-0 items-center lg:mt-1 lg:justify-end">
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold sm:text-xs',
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
          </div>
        )}
      </div>
    </nav>
  );
}
