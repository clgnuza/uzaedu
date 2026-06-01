'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { computeStudioReadiness } from '@/lib/ders-dagit-readiness';
import type { StudioOverview } from '@/hooks/use-ders-dagit-studio';
import {
  LayoutDashboard,
  Settings2,
  ClipboardCheck,
  Wand2,
  TableProperties,
  Send,
  SlidersHorizontal,
  Printer,
} from 'lucide-react';
import { workflowStatusLabel } from '@/lib/ders-dagit-labels';
import { matchStudioHref, STUDIO_FLOW } from '@/lib/ders-dagit-studio-nav';

const FLOW_ICONS = {
  '/ders-dagit/studyo': LayoutDashboard,
  '/ders-dagit/studyo/kurulum': Settings2,
  '/ders-dagit/studyo/dogrulama': ClipboardCheck,
  '/ders-dagit/studyo/uret': Wand2,
  '/ders-dagit/studyo/program': TableProperties,
  '/ders-dagit/studyo/raporlar': Printer,
  '/ders-dagit/studyo/ayarlar': SlidersHorizontal,
} as const;

const FLOW = STUDIO_FLOW.map((f) => ({
  ...f,
  icon: FLOW_ICONS[f.href as keyof typeof FLOW_ICONS],
  exact: 'exact' in f && f.exact,
}));

const TONE_ACTIVE = 'dd-nav-pill-active';
const TONE_IDLE = 'dd-nav-pill text-muted-foreground hover:text-foreground';

export function StudioHubBar({ overview }: { overview: StudioOverview | null }) {
  const pathname = usePathname();
  const readiness = computeStudioReadiness(overview);
  const st = overview?.studio;
  const year = st?.academic_year ?? '';

  return (
    <div className="dd-hero print:hidden space-y-2.5 p-2.5 sm:space-y-3 sm:p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[rgb(var(--dd-accent))]">
            DersDağıt · Program merkezi
          </p>
          <p className="truncate text-sm font-semibold sm:text-base">
            {st?.name ?? 'Okul programı'}
            {year ? <span className="font-normal text-muted-foreground"> · {year}</span> : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-semibold sm:px-2.5 sm:text-xs',
              st?.workflow_status === 'published'
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200'
                : 'bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200',
            )}
          >
            {workflowStatusLabel(st?.workflow_status)}
          </span>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="relative size-9 sm:size-11">
              <svg className="size-9 -rotate-90 sm:size-11" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15" fill="none" className="stroke-muted" strokeWidth="3" />
                <circle
                  cx="18"
                  cy="18"
                  r="15"
                  fill="none"
                  className={cn(
                    'stroke-current transition-all',
                    readiness.percent >= 80
                      ? 'text-emerald-600'
                      : readiness.percent >= 50
                        ? 'text-amber-600'
                        : 'text-rose-600',
                  )}
                  strokeWidth="3"
                  strokeDasharray={`${readiness.percent * 0.94} 100`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold sm:text-[10px]">
                {readiness.percent}%
              </span>
            </div>
            <div className="hidden text-[10px] leading-tight text-muted-foreground sm:block">
              <div>Veri {readiness.phases.data.percent}%</div>
              <div>Kural {readiness.phases.rules.percent}%</div>
              <div>Program {readiness.phases.program.percent}%</div>
            </div>
          </div>
        </div>
      </div>
      <nav className="dd-nav-scroll -mx-0.5 hidden gap-1 overflow-x-auto pb-0.5 lg:flex">
        {FLOW.map(({ href, label, icon: Icon, exact }) => {
          const active = matchStudioHref(pathname ?? '', href, exact);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all sm:gap-1.5 sm:px-3 sm:py-2 sm:text-xs',
                active ? TONE_ACTIVE : TONE_IDLE,
              )}
            >
              <Icon className="size-3 sm:size-3.5" />
              {label}
            </Link>
          );
        })}
        <Link
          href="/ders-dagit/studyo/program?panel=publish"
          className={cn(
            'ml-auto inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium sm:gap-1.5 sm:px-3 sm:py-2 sm:text-xs',
            pathname.includes('program')
              ? 'text-indigo-700 dark:text-indigo-300'
              : 'text-muted-foreground hover:bg-white/60 dark:hover:bg-white/10',
          )}
        >
          <Send className="size-3 sm:size-3.5" />
          Yayın
        </Link>
      </nav>
    </div>
  );
}
