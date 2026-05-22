'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Settings2,
  ListChecks,
  Scale,
  Wand2,
  Send,
  Heart,
  Building2,
  BarChart3,
  Users,
  ClipboardCheck,
  BookOpen,
  GitBranch,
  CalendarRange,
} from 'lucide-react';

const STEPS = [
  { href: '/ders-dagit/stüdyo/kurulum', label: 'Kurulum', icon: Settings2 },
  { href: '/ders-dagit/stüdyo/donem', label: 'Dönem', icon: CalendarRange },
  { href: '/ders-dagit/stüdyo/ogretmenler', label: 'Öğretmenler', icon: Users },
  { href: '/ders-dagit/stüdyo/dersler', label: 'Dersler', icon: BookOpen },
  { href: '/ders-dagit/stüdyo/gruplar', label: 'Gruplar', icon: GitBranch },
  { href: '/ders-dagit/stüdyo/derslikler', label: 'Derslikler', icon: Building2 },
  { href: '/ders-dagit/stüdyo/atamalar', label: 'Atamalar', icon: ListChecks },
  { href: '/ders-dagit/stüdyo/kurallar', label: 'Kurallar', icon: Scale },
  { href: '/ders-dagit/stüdyo/dogrulama', label: 'Doğrulama', icon: ClipboardCheck },
  { href: '/ders-dagit/stüdyo/uret', label: 'Üret', icon: Wand2 },
  { href: '/ders-dagit/stüdyo/yayin', label: 'Yayın', icon: Send },
  { href: '/ders-dagit/stüdyo/adalet', label: 'Adalet', icon: BarChart3 },
] as const;

export function DersDagitStudioNav({ healthScore }: { healthScore?: number }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
      {STEPS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Icon className="size-4 shrink-0" />
            {label}
          </Link>
        );
      })}
      {healthScore != null && (
        <span
          className={cn(
            'ml-auto inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold',
            healthScore >= 80
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200'
              : healthScore >= 50
                ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100'
                : 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-100',
          )}
        >
          <Heart className="size-3.5" />
          Sağlık {healthScore}
        </span>
      )}
    </nav>
  );
}
