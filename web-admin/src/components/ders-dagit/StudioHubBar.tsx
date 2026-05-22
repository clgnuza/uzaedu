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
} from 'lucide-react';

const FLOW = [
  { href: '/ders-dagit/stüdyo', label: 'Özet', icon: LayoutDashboard, exact: true },
  { href: '/ders-dagit/stüdyo/kurulum', label: 'Kurulum', icon: Settings2 },
  { href: '/ders-dagit/stüdyo/dogrulama', label: 'Doğrula', icon: ClipboardCheck },
  { href: '/ders-dagit/stüdyo/uret', label: 'Üret', icon: Wand2 },
  { href: '/ders-dagit/stüdyo/program', label: 'Program', icon: TableProperties },
  { href: '/ders-dagit/stüdyo/ayarlar', label: 'Ayarlar', icon: SlidersHorizontal },
] as const;

const STATUS_LABEL: Record<string, string> = {
  draft: 'Taslak',
  generated: 'Üretildi',
  published: 'Yayında',
  reviewing: 'İnceleniyor',
};

export function StudioHubBar({ overview }: { overview: StudioOverview | null }) {
  const pathname = usePathname();
  const readiness = computeStudioReadiness(overview);
  const st = overview?.studio;
  const year = st?.academic_year ?? '';

  return (
    <div className="print:hidden space-y-3 rounded-xl border border-border bg-card/80 p-3 shadow-sm backdrop-blur-sm">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">DersDağıt Stüdyo</p>
          <p className="truncate text-sm font-semibold">
            {st?.name ?? 'Program stüdyosu'}
            {year ? <span className="text-muted-foreground"> · {year}</span> : null}
          </p>
        </div>
        <span
          className={cn(
            'rounded-full px-2.5 py-0.5 text-xs font-semibold',
            st?.workflow_status === 'published'
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60'
              : 'bg-muted text-muted-foreground',
          )}
        >
          {STATUS_LABEL[st?.workflow_status ?? ''] ?? st?.workflow_status ?? 'Taslak'}
        </span>
        <div className="flex items-center gap-2">
          <div className="relative size-11">
            <svg className="size-11 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15" fill="none" className="stroke-muted" strokeWidth="3" />
              <circle
                cx="18"
                cy="18"
                r="15"
                fill="none"
                className={cn(
                  'stroke-current transition-all',
                  readiness.percent >= 80 ? 'text-emerald-600' : readiness.percent >= 50 ? 'text-amber-600' : 'text-rose-600',
                )}
                strokeWidth="3"
                strokeDasharray={`${readiness.percent * 0.94} 100`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">
              {readiness.percent}%
            </span>
          </div>
          <div className="text-[10px] leading-tight text-muted-foreground">
            <div>Veri {readiness.phases.data.percent}%</div>
            <div>Kural {readiness.phases.rules.percent}%</div>
            <div>Program {readiness.phases.program.percent}%</div>
          </div>
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto">
        {FLOW.map(({ href, label, icon: Icon, ...rest }) => {
          const exact = 'exact' in rest && rest.exact;
          const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </Link>
          );
        })}
        <Link
          href="/ders-dagit/stüdyo/program?panel=publish"
          className={cn(
            'ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium',
            pathname.includes('program') ? 'text-primary' : 'text-muted-foreground hover:bg-muted',
          )}
        >
          <Send className="size-3.5" />
          Yayın
        </Link>
      </nav>
    </div>
  );
}
