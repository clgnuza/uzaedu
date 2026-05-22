'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const STEPS = [
  { href: '/ders-dagit/studyo/kurulum', label: '1 Kurulum', tone: 'indigo' },
  { href: '/ders-dagit/studyo/donem', label: '2 Dönem', tone: 'violet' },
  { href: '/ders-dagit/studyo/atamalar', label: '3 Atama', tone: 'teal' },
  { href: '/ders-dagit/studyo/kurallar', label: '4 Kurallar', tone: 'sky' },
  { href: '/ders-dagit/studyo/dogrulama', label: '5 Doğrula', tone: 'lavender' },
  { href: '/ders-dagit/studyo/uret', label: '6 Oluştur', tone: 'mint' },
  { href: '/ders-dagit/studyo/program', label: '7 Program', tone: 'amber' },
] as const;

const ACTIVE = 'dd-nav-pill-active';
const IDLE = 'dd-nav-pill text-muted-foreground hover:text-foreground';

export function StudioProgramStepper() {
  const pathname = usePathname();
  return (
    <nav className="dd-stepper dd-nav-scroll print:hidden hidden gap-0.5 overflow-x-auto p-1 text-[10px] md:flex sm:gap-1 sm:text-xs">
      {STEPS.map((s) => {
        const active = pathname === s.href || pathname.startsWith(`${s.href}/`);
        return (
          <Link
            key={s.href}
            href={s.href}
            className={cn(
              'shrink-0 rounded-md px-2 py-1 font-medium transition-all sm:px-2.5 sm:py-1.5',
              active ? ACTIVE : IDLE,
            )}
          >
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
