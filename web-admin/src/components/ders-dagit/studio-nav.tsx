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
  Layers,
  CalendarRange,
  LayoutGrid,
  Archive,
  TableProperties,
  SlidersHorizontal,
  Grid3x3,
} from 'lucide-react';

const STEPS = [
  { href: '/ders-dagit/studyo/kurulum', label: 'Kurulum', icon: Settings2, tone: 'indigo' },
  { href: '/ders-dagit/studyo/donem', label: 'Dönem', icon: CalendarRange, tone: 'violet' },
  { href: '/ders-dagit/studyo/sinif-saatleri', label: 'Sınıf saatleri', icon: Grid3x3, tone: 'amber' },
  { href: '/ders-dagit/studyo/ogretmenler', label: 'Öğretmenler', icon: Users, tone: 'teal' },
  { href: '/ders-dagit/studyo/dersler', label: 'Dersler', icon: BookOpen, tone: 'sky' },
  { href: '/ders-dagit/studyo/gruplar', label: 'Gruplar', icon: GitBranch, tone: 'lavender' },
  { href: '/ders-dagit/studyo/secmeli', label: 'Seçmeli', icon: Layers, tone: 'mint' },
  { href: '/ders-dagit/studyo/derslikler', label: 'Derslikler', icon: Building2, tone: 'peach' },
  { href: '/ders-dagit/studyo/atamalar', label: 'Atamalar', icon: ListChecks, tone: 'rose' },
  { href: '/ders-dagit/studyo/planlama-iliskileri', label: 'Planlama', icon: GitBranch, tone: 'amber' },
  { href: '/ders-dagit/studyo/kurallar', label: 'Kurallar', icon: Scale, tone: 'peach' },
  { href: '/ders-dagit/studyo/dogrulama', label: 'Doğrulama', icon: ClipboardCheck, tone: 'indigo' },
  { href: '/ders-dagit/studyo/uret', label: 'Oluştur', icon: Wand2, tone: 'violet' },
  { href: '/ders-dagit/studyo/program', label: 'Program', icon: TableProperties, tone: 'teal' },
  { href: '/ders-dagit/studyo/yayin', label: 'Yayın', icon: Send, tone: 'sky' },
  { href: '/ders-dagit/studyo/ogretmen-program', label: 'Öğretmen', icon: LayoutGrid, tone: 'lavender' },
  { href: '/ders-dagit/studyo/arsiv', label: 'Arşiv', icon: Archive, tone: 'mint' },
  { href: '/ders-dagit/studyo/adalet', label: 'Adalet', icon: BarChart3, tone: 'peach' },
  { href: '/ders-dagit/studyo/ayarlar', label: 'Ayarlar', icon: SlidersHorizontal, tone: 'indigo' },
] as const;

const ACTIVE = 'dd-nav-pill-active';
const IDLE = 'dd-nav-pill text-muted-foreground hover:text-foreground';

export function DersDagitStudioNav({ healthScore }: { healthScore?: number }) {
  const pathname = usePathname();
  return (
    <nav className="dd-glass dd-glass-subtle dd-nav-scroll hidden gap-1.5 overflow-x-auto rounded-xl p-2 pb-1 lg:flex lg:flex-wrap lg:gap-2 lg:overflow-visible lg:pb-2">
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
