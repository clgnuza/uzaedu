'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  BarChart3,
  ClipboardList,
  FileStack,
  ScanLine,
  Settings2,
  type LucideIcon,
} from 'lucide-react';

type Item = {
  href: string;
  icon: LucideIcon;
  label: string;
  title: string;
  accent?: string;
  onClick?: () => void;
};

export function OptikQuickNav({ items }: { items: Item[] }) {
  return (
    <nav
      className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      aria-label="Optik kısayollar"
    >
      {items.map((it) => {
        const inner = (
          <>
            <it.icon className="size-4 shrink-0" strokeWidth={2.2} />
            <span className="truncate text-[10px] font-semibold leading-none">{it.label}</span>
          </>
        );
        const cls = cn(
          'flex min-w-[4.25rem] shrink-0 flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2 transition-colors',
          'hover:bg-muted/80',
          it.accent ?? 'border-border/80 bg-card/80',
        );
        if (it.onClick) {
          return (
            <button
              key={it.label}
              type="button"
              title={it.title}
              className={cls}
              onClick={it.onClick}
            >
              {inner}
            </button>
          );
        }
        return (
          <Link key={it.href} href={it.href} title={it.title} className={cls}>
            {inner}
          </Link>
        );
      })}
    </nav>
  );
}

export const OPTIK_OKUMA_QUICK_NAV: Item[] = [
  {
    href: '/optik-oturumlar',
    icon: ClipboardList,
    label: 'Oturum',
    title: 'Sınav oturumları — anahtar, tara, sonuç',
    accent: 'border-violet-500/35 bg-violet-500/10 text-violet-800 dark:text-violet-200',
  },
  {
    href: '/optik-raporlar',
    icon: BarChart3,
    label: 'Rapor',
    title: 'Optik raporlar ve istatistik',
    accent: 'border-fuchsia-500/35 bg-fuchsia-500/10 text-fuchsia-800 dark:text-fuchsia-200',
  },
  {
    href: '/optik-formlar',
    icon: FileStack,
    label: 'Form',
    title: 'PDF optik form şablonları',
  },
  {
    href: '/optik-okuma',
    icon: ScanLine,
    label: 'Serbest',
    title: 'Oturumsuz tek kağıt tarama',
  },
];
